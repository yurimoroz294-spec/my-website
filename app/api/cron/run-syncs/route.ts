import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { runSync } from '@/lib/sync/runner'

// Called by Vercel Cron every 5 minutes
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  const dueSyncs = await prisma.sync.findMany({
    where: {
      isActive: true,
      schedule: { not: 'MANUAL' },
      OR: [
        { nextRunAt: null },
        { nextRunAt: { lte: now } },
      ],
    },
    select: { id: true, schedule: true },
    take: 50,
  })

  const results = await Promise.allSettled(
    dueSyncs.map(sync => runSync(sync.id))
  )

  const summary = {
    total: dueSyncs.length,
    success: results.filter(r => r.status === 'fulfilled' && r.value.status === 'SUCCESS').length,
    failed: results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 'FAILED')).length,
    timestamp: now.toISOString(),
  }

  return NextResponse.json(summary)
}
