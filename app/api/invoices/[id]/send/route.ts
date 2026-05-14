import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { sendInvoiceToTarget } from '@/lib/invoice-sender'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const clerkId = await getAuthUserId()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (user.plan === 'FREE') {
    return NextResponse.json({ error: 'Vyžaduje Pro plán.' }, { status: 403 })
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } })
  if (!invoice || invoice.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (invoice.status === 'SENT') {
    return NextResponse.json({ error: 'Faktura již byla odeslána.' }, { status: 409 })
  }

  if (!user.invoiceTargetPlatform) {
    return NextResponse.json(
      { error: 'Není nastaven cílový systém. Vyberte ho v záložce Faktury → Nastavení.' },
      { status: 422 }
    )
  }

  try {
    await sendInvoiceToTarget(invoice.id, user.id)
    const updated = await prisma.invoice.findUnique({ where: { id: invoice.id } })
    return NextResponse.json({ invoice: updated })
  } catch (e) {
    // sendInvoiceToTarget already updated invoice status to FAILED in DB
    const updated = await prisma.invoice.findUnique({ where: { id: invoice.id } })
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Chyba při odesílání', invoice: updated },
      { status: 502 }
    )
  }
}
