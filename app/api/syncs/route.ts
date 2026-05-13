import { getAuthUserId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { checkLimit } from '@/lib/usage'
import { z } from 'zod'

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  sourceConnectionId: z.string(),
  targetConnectionId: z.string(),
  templateId: z.string().optional(),
  fieldMapping: z.record(z.string()),
  schedule: z.enum(['MANUAL', 'EVERY_5MIN', 'EVERY_HOUR', 'DAILY', 'WEEKLY']).default('DAILY'),
})

export async function GET() {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const syncs = await prisma.sync.findMany({
    where: { userId: user.id },
    include: {
      sourceConnection: { select: { platform: true, name: true } },
      targetConnection: { select: { platform: true, name: true } },
      logs: { orderBy: { startedAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ syncs })
}

export async function POST(req: Request) {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.errors }, { status: 400 })

  const { name, sourceConnectionId, targetConnectionId, templateId, fieldMapping, schedule } = parsed.data

  // Validate EVERY_5MIN requires Pro
  if (schedule === 'EVERY_5MIN' && user.plan === 'FREE') {
    return NextResponse.json({ error: 'Plánování každých 5 minut vyžaduje Pro plán.' }, { status: 403 })
  }

  const [src, tgt] = await Promise.all([
    prisma.connection.findFirst({ where: { id: sourceConnectionId, userId: user.id } }),
    prisma.connection.findFirst({ where: { id: targetConnectionId, userId: user.id } }),
  ])
  if (!src || !tgt) return NextResponse.json({ error: 'Invalid connection IDs' }, { status: 400 })

  const sync = await prisma.sync.create({
    data: { userId: user.id, name, sourceConnectionId, targetConnectionId, templateId, fieldMapping, schedule, isActive: true },
  })

  return NextResponse.json({ sync }, { status: 201 })
}
