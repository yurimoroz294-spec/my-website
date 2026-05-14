import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

export async function GET() {
  const clerkId = await getAuthUserId()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const invoices = await prisma.invoice.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({ invoices, autoSend: user.autoSendInvoices })
}

const patchSchema = z.object({
  autoSendInvoices: z.boolean(),
})

export async function PATCH(req: Request) {
  const clerkId = await getAuthUserId()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await prisma.user.update({
    where: { id: user.id },
    data: { autoSendInvoices: parsed.data.autoSendInvoices },
  })

  return NextResponse.json({ ok: true })
}
