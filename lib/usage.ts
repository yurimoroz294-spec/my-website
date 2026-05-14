import { prisma } from './db/prisma'
import { Plan } from '@prisma/client'

const LIMITS: Record<Plan, { syncs: number; records: number }> = {
  FREE:     { syncs: 100,       records: 5_000 },
  PRO:      { syncs: Infinity,  records: Infinity },
  BUSINESS: { syncs: Infinity,  records: Infinity },
}

export function getCurrentMonth(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function getUsage(userId: string, month: string = getCurrentMonth()) {
  const record = await prisma.usageRecord.findUnique({ where: { userId_month: { userId, month } } })
  return { syncsRun: record?.syncsRun ?? 0, recordsProcessed: record?.recordsProcessed ?? 0, month }
}

export async function incrementUsage(userId: string, syncsRun = 1, records = 0, month: string = getCurrentMonth()): Promise<void> {
  await prisma.usageRecord.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, syncsRun, recordsProcessed: records },
    update: { syncsRun: { increment: syncsRun }, recordsProcessed: { increment: records } },
  })
}

export async function checkLimit(userId: string, plan: Plan, month: string = getCurrentMonth()): Promise<{ allowed: boolean; remaining: number }> {
  const limit = LIMITS[plan].syncs
  if (limit === Infinity) return { allowed: true, remaining: Infinity }

  const usage = await getUsage(userId, month)
  const remaining = Math.max(0, limit - usage.syncsRun)
  return { allowed: remaining > 0, remaining }
}

// Atomic: reserve a sync slot before running. Returns `false` if at limit.
// Uses upsert + recheck pattern so concurrent calls can't both succeed past the limit.
export async function reserveSyncSlot(userId: string, plan: Plan, month: string = getCurrentMonth()): Promise<boolean> {
  const limit = LIMITS[plan].syncs
  if (limit === Infinity) {
    await incrementUsage(userId, 1, 0, month)
    return true
  }

  // Increment then check; if we went over, roll back. The increment itself is atomic.
  await prisma.usageRecord.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, syncsRun: 1, recordsProcessed: 0 },
    update: { syncsRun: { increment: 1 } },
  })
  const after = await prisma.usageRecord.findUnique({ where: { userId_month: { userId, month } } })
  if ((after?.syncsRun ?? 0) > limit) {
    await prisma.usageRecord.update({
      where: { userId_month: { userId, month } },
      data: { syncsRun: { decrement: 1 } },
    })
    return false
  }
  return true
}
