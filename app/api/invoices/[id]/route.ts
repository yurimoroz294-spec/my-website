import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const clerkId = await getAuthUserId()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } })
  if (!invoice || invoice.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.invoice.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
