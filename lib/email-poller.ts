import { prisma } from './db/prisma'
import { getCredentials } from './kv'
import { fetchUnseenInvoiceAttachments, type ImapCredentials } from './integrations/imap'
import { parseInvoiceFromBase64 } from './ai/mapper'
import { sendInvoiceToTarget } from './invoice-sender'

export interface PollResult {
  found: number
  saved: number
  errors: number
}

// Polls the EMAIL_IMAP inbox for a single user, parses new invoices, optionally auto-sends.
export async function pollUserInbox(userId: string): Promise<PollResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { autoSendInvoices: true, invoiceTargetPlatform: true, plan: true },
  })
  if (!user) return { found: 0, saved: 0, errors: 0 }

  const conn = await prisma.connection.findFirst({
    where: { userId, platform: 'EMAIL_IMAP', isActive: true },
  })
  if (!conn) return { found: 0, saved: 0, errors: 0 }

  const creds = await getCredentials(conn.kvKey) as ImapCredentials | null
  if (!creds) return { found: 0, saved: 0, errors: 0 }

  const attachments = await fetchUnseenInvoiceAttachments(creds)

  let saved = 0
  let errors = 0

  for (const att of attachments) {
    try {
      const mimeType = att.contentType === 'application/pdf' ? 'application/pdf' : 'image/jpeg'
      const parsed = await parseInvoiceFromBase64(att.base64, mimeType)

      const invoice = await prisma.invoice.create({
        data: {
          userId,
          fromEmail: att.fromEmail,
          subject: att.subject || null,
          fileName: att.filename,
          status: 'PARSED',
          variabilniSymbol: parsed.variabilniSymbol ?? null,
          ico: parsed.ico ?? null,
          dic: parsed.dic ?? null,
          company: parsed.company ?? null,
          date: parsed.date ?? null,
          dateDue: parsed.dateDue ?? null,
          amount: parsed.amount ?? null,
          amountWithVat: parsed.amountWithVat ?? null,
          vatRate: parsed.vatRate ?? null,
          currency: parsed.currency ?? 'CZK',
          items: parsed.items ? (parsed.items as any) : [],
        },
      })

      if (user.autoSendInvoices && user.invoiceTargetPlatform) {
        sendInvoiceToTarget(invoice.id, userId).catch(() => {})
      }

      saved++
    } catch {
      errors++
    }
  }

  return { found: attachments.length, saved, errors }
}

// Polls all PRO+ users who have an active EMAIL_IMAP connection.
// Called from the cron job; returns a summary.
export async function pollAllInboxes(): Promise<{ users: number; found: number; saved: number; errors: number }> {
  const connections = await prisma.connection.findMany({
    where: { platform: 'EMAIL_IMAP', isActive: true },
    select: { userId: true },
  })

  // Filter to PRO/BUSINESS users
  const userIds = connections.map(c => c.userId)
  const proUsers = await prisma.user.findMany({
    where: { id: { in: userIds }, plan: { in: ['PRO', 'BUSINESS'] } },
    select: { id: true },
  })

  let totalFound = 0
  let totalSaved = 0
  let totalErrors = 0

  const results = await Promise.allSettled(
    proUsers.map(u => pollUserInbox(u.id))
  )

  for (const r of results) {
    if (r.status === 'fulfilled') {
      totalFound += r.value.found
      totalSaved += r.value.saved
      totalErrors += r.value.errors
    } else {
      totalErrors++
    }
  }

  return { users: proUsers.length, found: totalFound, saved: totalSaved, errors: totalErrors }
}
