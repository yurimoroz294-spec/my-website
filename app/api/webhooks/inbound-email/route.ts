import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { getUserByInboxToken } from '@/lib/invoices'
import { parseInvoiceFromBase64 } from '@/lib/ai/mapper'
import { getCredentials } from '@/lib/kv'
import { PohodaClient } from '@/lib/integrations/pohoda'

// SendGrid Inbound Parse sends multipart/form-data POST.
// Secure via HTTP Basic Auth: configure SendGrid webhook URL as
//   https://webhook:{SENDGRID_INBOUND_SECRET}@yourdomain.com/api/webhooks/inbound-email

function verifyBasicAuth(authHeader: string | null): boolean {
  const secret = process.env.SENDGRID_INBOUND_SECRET
  if (!secret) return false
  if (!authHeader?.startsWith('Basic ')) return false
  const encoded = authHeader.slice(6)
  const expected = Buffer.from(`webhook:${secret}`).toString('base64')
  try {
    const a = Buffer.from(encoded)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// Extract inbox token from a To address like "faktury+abc123@inbound.czechdatasync.cz"
function extractToken(toHeader: string): string | null {
  const match = toHeader.match(/faktury\+([a-f0-9]{24})@/i)
  return match?.[1] ?? null
}

export async function POST(req: Request) {
  if (!verifyBasicAuth(req.headers.get('authorization'))) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const to = String(form.get('to') ?? '')
  const from = String(form.get('from') ?? '')
  const subject = String(form.get('subject') ?? '')

  const token = extractToken(to)
  if (!token) return new NextResponse('Unknown recipient', { status: 200 })

  const user = await getUserByInboxToken(token)
  if (!user) return new NextResponse('Unknown recipient', { status: 200 })

  // Pro plan required for invoice inbox
  if (user.plan === 'FREE') {
    return new NextResponse('Plan not supported', { status: 200 })
  }

  // Find PDF/image attachment (SendGrid names them attachment1, attachment2, ...)
  let fileBase64: string | null = null
  let fileName: string | null = null
  let fileMime = 'application/pdf'

  const attachmentInfoRaw = form.get('attachment-info')
  let attachmentInfo: Record<string, { filename: string; type: string }> = {}
  try {
    attachmentInfo = JSON.parse(String(attachmentInfoRaw ?? '{}'))
  } catch { /* ignore */ }

  const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']

  for (const [key, meta] of Object.entries(attachmentInfo)) {
    if (!ALLOWED_TYPES.includes(meta.type)) continue
    const file = form.get(key) as File | null
    if (!file) continue
    if (file.size > 5 * 1024 * 1024) continue

    const buffer = await file.arrayBuffer()
    fileBase64 = Buffer.from(buffer).toString('base64')
    fileName = meta.filename
    fileMime = meta.type
    break
  }

  if (!fileBase64) {
    // No supported attachment — record as FAILED so user sees it in UI
    await prisma.invoice.create({
      data: {
        userId: user.id,
        fromEmail: from,
        subject: subject || null,
        status: 'FAILED',
        errorMessage: 'Email neobsahoval PDF ani obrázek faktury.',
      },
    })
    return new NextResponse('OK', { status: 200 })
  }

  // Parse invoice with AI OCR
  let parsed
  try {
    parsed = await parseInvoiceFromBase64(fileBase64, fileMime)
  } catch (e) {
    await prisma.invoice.create({
      data: {
        userId: user.id,
        fromEmail: from,
        subject: subject || null,
        fileName: fileName ?? undefined,
        status: 'FAILED',
        errorMessage: `AI parsování selhalo: ${e instanceof Error ? e.message : 'unknown error'}`,
      },
    })
    return new NextResponse('OK', { status: 200 })
  }

  // Persist the parsed invoice
  const invoice = await prisma.invoice.create({
    data: {
      userId: user.id,
      fromEmail: from,
      subject: subject || null,
      fileName: fileName ?? undefined,
      status: 'PARSED',
      variabilniSymbol: parsed.variabilniSymbol ?? null,
      ico: parsed.ico ?? null,
      dic: parsed.dic ?? null,
      company: parsed.company ?? null,
      amount: parsed.amount ?? null,
      amountWithVat: parsed.amountWithVat ?? null,
      vatRate: parsed.vatRate ?? null,
      currency: parsed.currency ?? 'CZK',
      date: parsed.date ?? null,
      dateDue: parsed.dateDue ?? null,
      items: parsed.items ? (parsed.items as object) : undefined,
    },
  })

  // Auto-send to Pohoda if enabled and user has a Pohoda connection
  if (user.autoSendInvoices) {
    await sendToPohoda(invoice.id, user.id).catch(() => {/* handled inside */})
  }

  return new NextResponse('OK', { status: 200 })
}

async function sendToPohoda(invoiceId: string, userId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return

  const connection = await prisma.connection.findFirst({
    where: { userId, platform: 'POHODA', isActive: true },
  })
  if (!connection) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'FAILED', errorMessage: 'Nemáte aktivní Pohoda propojení.' },
    })
    return
  }

  const creds = await getCredentials(connection.kvKey)
  if (!creds) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'FAILED', errorMessage: 'Nepodařilo se načíst přihlašovací údaje Pohoda.' },
    })
    return
  }

  if (!invoice.variabilniSymbol || !invoice.date || !invoice.dateDue || invoice.amount == null || invoice.amountWithVat == null) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'FAILED', errorMessage: 'Faktura nemá všechna povinná pole (variabilní symbol, datum, částka).' },
    })
    return
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
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'SENT', sentAt: new Date() },
    })
  } catch (e) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'FAILED', errorMessage: `Pohoda chyba: ${e instanceof Error ? e.message : 'unknown'}` },
    })
  }
}

// Export sendToPohoda so the manual-send API route can reuse it
export { sendToPohoda }
