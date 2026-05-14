import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { getUserByInboxToken } from '@/lib/invoices'
import { parseInvoiceFromBase64 } from '@/lib/ai/mapper'
import { sendInvoiceToTarget } from '@/lib/invoice-sender'

// Secured via HTTP Basic Auth in the SendGrid webhook URL:
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

  if (user.plan === 'FREE') return new NextResponse('Plan not supported', { status: 200 })

  // Find first supported PDF/image attachment
  const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
  let fileBase64: string | null = null
  let fileName: string | null = null
  let fileMime = 'application/pdf'

  let attachmentInfo: Record<string, { filename: string; type: string }> = {}
  try {
    attachmentInfo = JSON.parse(String(form.get('attachment-info') ?? '{}'))
  } catch { /* ignore */ }

  for (const [key, meta] of Object.entries(attachmentInfo)) {
    if (!ALLOWED_TYPES.includes(meta.type)) continue
    const file = form.get(key) as File | null
    if (!file || file.size > 5 * 1024 * 1024) continue
    const buffer = await file.arrayBuffer()
    fileBase64 = Buffer.from(buffer).toString('base64')
    fileName = meta.filename
    fileMime = meta.type
    break
  }

  if (!fileBase64) {
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

  // AI OCR parse
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
        errorMessage: `AI parsování selhalo: ${e instanceof Error ? e.message : 'unknown'}`,
      },
    })
    return new NextResponse('OK', { status: 200 })
  }

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

  // Auto-send to whichever platform the user configured
  if (user.autoSendInvoices && user.invoiceTargetPlatform) {
    await sendInvoiceToTarget(invoice.id, user.id).catch(() => {/* status updated inside */})
  }

  return new NextResponse('OK', { status: 200 })
}
