import { ImapFlow } from 'imapflow'

export interface ImapCredentials {
  host: string       // e.g. imap.gmail.com, imap.seznam.cz
  port: number       // 993 (TLS) or 143 (STARTTLS)
  user: string       // email address
  password: string   // password or app-specific password
  folder?: string    // defaults to INBOX
  tls?: boolean      // defaults to true for port 993
}

export interface ImapAttachment {
  filename: string
  contentType: string
  base64: string
  subject: string
  fromEmail: string
}

function makeClient(creds: ImapCredentials): ImapFlow {
  const secure = creds.tls !== undefined ? creds.tls : creds.port === 993
  return new ImapFlow({
    host: creds.host,
    port: creds.port,
    secure,
    auth: { user: creds.user, pass: creds.password },
    logger: false,
    // Abort any operation after 20 seconds — safe for Vercel functions
    socketTimeout: 20_000,
    connectionTimeout: 10_000,
  })
}

export async function testImapConnection(creds: ImapCredentials): Promise<boolean> {
  const client = makeClient(creds)
  try {
    await client.connect()
    await client.logout()
    return true
  } catch {
    try { client.close() } catch {}
    return false
  }
}

// Fetches unread emails that have PDF or image attachments.
// Marks fetched messages as \Seen so they won't be re-processed.
// Returns at most `limit` attachments (default 20 per run).
export async function fetchUnseenInvoiceAttachments(
  creds: ImapCredentials,
  limit = 20,
): Promise<ImapAttachment[]> {
  const client = makeClient(creds)
  const results: ImapAttachment[] = []

  await client.connect()
  try {
    const folder = creds.folder ?? 'INBOX'
    await client.mailboxOpen(folder)

    // Search for unseen messages
    const uids = await client.search({ seen: false }, { uid: true })
    if (!uids || uids.length === 0) return []

    const toProcess = uids.slice(0, limit)

    for (const uid of toProcess) {
      try {
        const msg = await client.fetchOne(String(uid), { bodyStructure: true, envelope: true }, { uid: true })
        if (!msg) continue

        const envelope = msg.envelope
        const subject = envelope?.subject ?? ''
        const fromEmail = envelope?.from?.[0]?.address ?? ''

        // Walk body structure to find PDF/image parts
        const parts = flattenBodyStructure(msg.bodyStructure)
        const invoiceParts = parts.filter(p =>
          p.type === 'application/pdf' ||
          p.type === 'image/jpeg' ||
          p.type === 'image/png' ||
          p.type === 'image/tiff'
        )

        if (invoiceParts.length === 0) {
          // No relevant attachment — still mark as seen to avoid re-checking
          await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
          continue
        }

        for (const part of invoiceParts.slice(0, 3)) {
          const { content } = await client.download(String(uid), part.part, { uid: true })
          if (!content) continue

          const chunks: Buffer[] = []
          for await (const chunk of content) chunks.push(chunk)
          const buf = Buffer.concat(chunks)

          // Skip attachments over 5 MB (same limit as SendGrid webhook handler)
          if (buf.byteLength > 5 * 1024 * 1024) continue

          const filename = part.dispositionParameters?.filename
            ?? part.parameters?.name
            ?? `attachment.${part.type === 'application/pdf' ? 'pdf' : 'jpg'}`

          results.push({
            filename,
            contentType: part.type,
            base64: buf.toString('base64'),
            subject,
            fromEmail,
          })
        }

        await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
      } catch {
        // Skip problematic messages; don't mark as seen so they retry next run
      }
    }
  } finally {
    try { await client.logout() } catch { try { client.close() } catch {} }
  }

  return results
}

interface BodyPart {
  part: string
  type: string
  parameters?: Record<string, string>
  dispositionParameters?: Record<string, string>
}

function flattenBodyStructure(node: any, partNum = ''): BodyPart[] {
  if (!node) return []

  const results: BodyPart[] = []
  const type = node.type ? `${node.type}/${node.subtype}`.toLowerCase() : ''

  if (node.childNodes?.length) {
    node.childNodes.forEach((child: any, i: number) => {
      const childPart = partNum ? `${partNum}.${i + 1}` : String(i + 1)
      results.push(...flattenBodyStructure(child, childPart))
    })
  } else if (type && partNum) {
    results.push({
      part: partNum,
      type,
      parameters: node.parameters,
      dispositionParameters: node.dispositionParameters,
    })
  }

  return results
}
