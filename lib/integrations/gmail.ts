import { fetchWithTimeout } from './http'
import type { ImapAttachment } from './imap'

export interface GmailCredentials {
  email: string
  refreshToken: string
  accessToken: string
  expiresAt: number | string  // stored as string in KV, loaded back as string
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://gmail.googleapis.com/gmail/v1/users/me'

export class GmailClient {
  constructor(private creds: GmailCredentials) {}

  async testConnection(): Promise<boolean> {
    try {
      const token = await this.getAccessToken()
      const res = await fetchWithTimeout(`${API}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.ok
    } catch {
      return false
    }
  }

  // Fetches unread messages with PDF/image attachments, marks them as read.
  async fetchUnseenInvoiceAttachments(limit = 20): Promise<ImapAttachment[]> {
    const token = await this.getAccessToken()

    // List unread messages that have at least one attachment
    const listRes = await fetchWithTimeout(
      `${API}/messages?q=is:unread has:attachment&maxResults=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!listRes.ok) return []
    const listData = await listRes.json()
    const messages: { id: string }[] = listData.messages ?? []
    if (messages.length === 0) return []

    const results: ImapAttachment[] = []

    for (const { id } of messages) {
      try {
        const msgRes = await fetchWithTimeout(`${API}/messages/${id}?format=full`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!msgRes.ok) continue
        const msg = await msgRes.json()

        const subject = headerValue(msg.payload?.headers, 'Subject') ?? ''
        const fromRaw = headerValue(msg.payload?.headers, 'From') ?? ''
        const fromEmail = extractEmail(fromRaw)

        const parts = flattenParts(msg.payload)
        const invoiceParts = parts.filter(p =>
          p.mimeType === 'application/pdf' ||
          p.mimeType === 'image/jpeg' ||
          p.mimeType === 'image/png' ||
          p.mimeType === 'image/tiff',
        )

        for (const part of invoiceParts.slice(0, 3)) {
          let base64: string | null = null

          if (part.body?.attachmentId) {
            const attRes = await fetchWithTimeout(
              `${API}/messages/${id}/attachments/${part.body.attachmentId}`,
              { headers: { Authorization: `Bearer ${token}` } },
            )
            if (!attRes.ok) continue
            const attData = await attRes.json()
            base64 = urlSafeToStd(attData.data)
          } else if (part.body?.data) {
            base64 = urlSafeToStd(part.body.data)
          }

          if (!base64) continue

          // Skip > 5 MB
          if (base64.length * 0.75 > 5 * 1024 * 1024) continue

          const filename =
            part.filename ||
            (part.mimeType === 'application/pdf' ? 'attachment.pdf' : 'attachment.jpg')

          results.push({ filename, contentType: part.mimeType, base64, subject, fromEmail })
        }

        // Mark as read regardless of whether we found attachments
        await fetchWithTimeout(`${API}/messages/${id}/modify`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
        })
      } catch {
        // Skip problematic messages silently
      }
    }

    return results
  }

  private async getAccessToken(): Promise<string> {
    if (this.creds.accessToken && Date.now() < Number(this.creds.expiresAt) - 60_000) {
      return this.creds.accessToken
    }

    const res = await fetchWithTimeout(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.creds.refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      }).toString(),
    })
    if (!res.ok) throw new Error(`Gmail token refresh failed: ${res.status}`)
    const data = await res.json()
    if (!data.access_token) throw new Error('Gmail vrátil prázdný access token.')
    this.creds.accessToken = data.access_token
    this.creds.expiresAt = String(Date.now() + Math.min(Math.max(Number(data.expires_in) || 3600, 60), 86400) * 1000)
    return this.creds.accessToken
  }
}

function headerValue(headers: { name: string; value: string }[] | undefined, name: string): string | null {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? null
}

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match ? match[1] : from.trim()
}

// Gmail API uses URL-safe base64 (- and _ instead of + and /)
function urlSafeToStd(s: string): string {
  return s.replace(/-/g, '+').replace(/_/g, '/')
}

interface GmailPart {
  mimeType: string
  filename?: string
  body?: { attachmentId?: string; data?: string; size?: number }
  parts?: GmailPart[]
}

function flattenParts(node: GmailPart | undefined): GmailPart[] {
  if (!node) return []
  const results: GmailPart[] = []
  if (node.parts?.length) {
    for (const child of node.parts) results.push(...flattenParts(child))
  } else if (node.mimeType && node.body) {
    results.push(node)
  }
  return results
}
