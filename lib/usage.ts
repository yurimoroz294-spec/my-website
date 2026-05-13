import { prisma } from './db/prisma'
import { Plan } from '@prisma/client'

const LIMITS: Record<Plan, { syncs: number; records: number }> = {
  FREE:     { syncs: 100,       records: 5_000 },
  PRO:      { syncs: Infinity,  records: Infinity },
  BUSINESS: { syncs: Infinity,  records: Infinity },
}

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function getUsage(userId: string) {
  const month = getCurrentMonth()
  const record = await prisma.usageRecord.findUnique({ where: { userId_month: { userId, month } } })
  return { syncsRun: record?.syncsRun ?? 0, recordsProcessed: record?.recordsProcessed ?? 0, month }
}

export async function incrementUsage(userId: string, syncsRun = 1, records = 0): Promise<void> {
  const month = getCurrentMonth()
  await prisma.usageRecord.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, syncsRun, recordsProcessed: records },
    update: { syncsRun: { increment: syncsRun }, recordsProcessed: { increment: records } },
  })
}

export async function checkLimit(userId: string, plan: Plan): Promise<{ allowed: boolean; remaining: number }> {
  const limit = LIMITS[plan].syncs
  if (limit === Infinity) return { allowed: true, remaining: Infinity }

  const usage = await getUsage(userId)
  const remaining = Math.max(0, limit - usage.syncsRun)
  return { allowed: remaining > 0, remaining }
}
