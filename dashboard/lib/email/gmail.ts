import { google } from 'googleapis'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/email/connect/gmail/callback`,
  )
}

export function getAuthUrl(state: string): string {
  const client = getOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  })
}

export async function exchangeCode(code: string) {
  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)

  const oauth2 = google.oauth2({ version: 'v2', auth: client })
  const { data } = await oauth2.userinfo.get()

  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token ?? null,
    token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    email: data.email!,
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const client = getOAuthClient()
  client.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await client.refreshAccessToken()
  return credentials.access_token!
}

export async function fetchInvoiceEmails(
  accessToken: string,
  sinceHours = 24,
): Promise<Array<{
  messageId: string
  subject: string
  from: string
  receivedAt: string
  attachments: Array<{ filename: string; mimeType: string; data: Buffer }>
}>> {
  const client = getOAuthClient()
  client.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth: client })

  const after = Math.floor((Date.now() - sinceHours * 3600 * 1000) / 1000)
  const { data: list } = await gmail.users.messages.list({
    userId: 'me',
    q: `after:${after} has:attachment (filename:pdf OR filename:jpg OR filename:png OR filename:tiff OR filename:isdoc)`,
    maxResults: 50,
  })

  if (!list.messages?.length) return []

  const results = await Promise.all(
    list.messages.map(async msg => {
      if (!msg.id) return null
      const { data: full } = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      })

      const headers = full.payload?.headers ?? []
      const subject = headers.find(h => h.name === 'Subject')?.value ?? ''
      const from = headers.find(h => h.name === 'From')?.value ?? ''

      const attachments: Array<{ filename: string; mimeType: string; data: Buffer }> = []

      async function collectParts(parts: NonNullable<typeof full.payload>['parts']) {
        if (!parts) return
        for (const part of parts) {
          if (part.parts) await collectParts(part.parts)
          const filename = part.filename ?? ''
          if (!filename || !part.body) continue
          const ext = filename.split('.').pop()?.toLowerCase() ?? ''
          if (!['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'isdoc'].includes(ext)) continue

          let rawData: string | null = null
          if (part.body.data) {
            rawData = part.body.data
          } else if (part.body.attachmentId && msg.id) {
            const { data: att } = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: msg.id,
              id: part.body.attachmentId,
            })
            rawData = att.data ?? null
          }
          if (rawData) {
            attachments.push({
              filename,
              mimeType: part.mimeType ?? 'application/octet-stream',
              data: Buffer.from(rawData, 'base64url'),
            })
          }
        }
      }

      await collectParts(full.payload?.parts ?? [])

      return {
        messageId: full.id ?? msg.id!,
        subject,
        from,
        receivedAt: new Date(parseInt(full.internalDate ?? '0')).toISOString(),
        attachments,
      }
    })
  )

  return results.filter((r): r is NonNullable<typeof r> => r !== null && r.attachments.length > 0)
}
