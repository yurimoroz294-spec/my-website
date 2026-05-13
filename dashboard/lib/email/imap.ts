import { ImapFlow } from 'imapflow'
import { simpleParser, type ParsedMail, type AddressObject } from 'mailparser'

export interface ImapConfig {
  host: string
  port: number
  username: string
  password: string
  useSSL: boolean
}

export interface EmailAttachment {
  filename: string
  mimeType: string
  data: Buffer
}

export interface ParsedEmail {
  messageId: string
  subject: string
  from: string
  receivedAt: string
  attachments: EmailAttachment[]
}

const INVOICE_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'isdoc', 'isdocx'])

export async function testImapConnection(config: ImapConfig): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.useSSL,
    auth: { user: config.username, pass: config.password },
    logger: false,
  })
  await client.connect()
  await client.logout()
}

export async function fetchInvoiceEmailsImap(
  config: ImapConfig,
  sinceDate?: Date,
): Promise<ParsedEmail[]> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.useSSL,
    auth: { user: config.username, pass: config.password },
    logger: false,
  })

  await client.connect()
  const results: ParsedEmail[] = []

  try {
    await client.mailboxOpen('INBOX')
    const since = sinceDate ?? new Date(Date.now() - 24 * 3600 * 1000)

    for await (const msg of client.fetch({ since }, { source: true })) {
      if (!msg.source) continue

      // simpleParser without callback returns Promise<ParsedMail>
      const parsed: ParsedMail = await simpleParser(msg.source)

      const attachments: EmailAttachment[] = ((parsed.attachments as unknown as {
        filename?: string
        contentType: string
        content: Buffer
      }[]) ?? [])
        .filter(att => {
          const ext = (att.filename ?? '').split('.').pop()?.toLowerCase() ?? ''
          return INVOICE_EXTENSIONS.has(ext)
        })
        .map(att => ({
          filename: att.filename ?? 'attachment',
          mimeType: att.contentType,
          data: att.content,
        }))

      if (!attachments.length) continue

      const fromAddr = parsed.from as AddressObject | undefined
      results.push({
        messageId: parsed.messageId ?? String(msg.uid),
        subject: parsed.subject ?? '',
        from: fromAddr?.text ?? '',
        receivedAt: (parsed.date ?? new Date()).toISOString(),
        attachments,
      })
    }
  } finally {
    await client.logout()
  }

  return results
}
