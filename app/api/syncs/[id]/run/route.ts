import { getAuthUserId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { runSync } from '@/lib/sync/runner'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const sync = await prisma.sync.findFirst({ where: { id: params.id, userId: user.id } })
  if (!sync) return NextResponse.json({ error: 'Sync not found' }, { status: 404 })

  const result = await runSync(params.id)
  return NextResponse.json(result)
}
