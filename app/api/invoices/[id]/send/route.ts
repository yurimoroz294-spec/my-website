import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { getCredentials } from '@/lib/kv'
import { PohodaClient } from '@/lib/integrations/pohoda'

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

  if (!invoice.variabilniSymbol || !invoice.date || !invoice.dateDue || invoice.amount == null || invoice.amountWithVat == null) {
    return NextResponse.json(
      { error: 'Faktura nemá všechna povinná pole (variabilní symbol, datum, částka).' },
      { status: 422 }
    )
  }

  const connection = await prisma.connection.findFirst({
    where: { userId: user.id, platform: 'POHODA', isActive: true },
  })
  if (!connection) {
    return NextResponse.json({ error: 'Nemáte aktivní Pohoda propojení.' }, { status: 422 })
  }

  const creds = await getCredentials(connection.kvKey)
  if (!creds) {
    return NextResponse.json({ error: 'Nepodařilo se načíst přihlašovací údaje Pohoda.' }, { status: 500 })
  }

  const client = new PohodaClient({
    url: creds.url,
    username: creds.username,
    password: creds.password,
    ico: creds.ico,
  })

  try {
    await client.createInvoice({
      variabilniSymbol: invoice.variabilniSymbol,
      ico: invoice.ico ?? undefined,
      dic: invoice.dic ?? undefined,
      company: invoice.company ?? undefined,
      date: invoice.date,
      dateDue: invoice.dateDue,
      amount: invoice.amount,
      amountWithVat: invoice.amountWithVat,
      vatRate: invoice.vatRate ?? 21,
      currency: invoice.currency ?? 'CZK',
      items: (invoice.items as any[]) ?? [],
    })

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'SENT', sentAt: new Date(), errorMessage: null },
    })

    return NextResponse.json({ invoice: updated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'FAILED', errorMessage: `Pohoda chyba: ${msg}` },
    })
    return NextResponse.json({ error: `Pohoda chyba: ${msg}` }, { status: 502 })
  }
}
