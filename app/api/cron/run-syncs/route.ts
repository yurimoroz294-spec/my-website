import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { runSync } from '@/lib/sync/runner'

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// Called by Vercel Cron every 5 minutes
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })

  const authHeader = req.headers.get('authorization') ?? ''
  if (!safeEqual(authHeader, `Bearer ${secret}`)) {
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
