import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { storeCredentials } from '@/lib/kv'
import { fetchWithTimeout } from '@/lib/integrations/http'
import { randomUUID } from 'crypto'

export async function GET(req: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const clerkId = await getAuthUserId()
  if (!clerkId) return NextResponse.redirect(new URL('/sign-in', appUrl))

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  if (oauthError || !code || !state) {
    return NextResponse.redirect(new URL('/app/connections?error=gmail_denied', appUrl))
  }

  // Verify state cookie
  const cookieHeader = req.headers.get('cookie') ?? ''
  const savedState = parseCookie(cookieHeader, 'gmail_oauth_state')
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL('/app/connections?error=gmail_state', appUrl))
  }

  // Exchange code for tokens
  const tokenRes = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: `${appUrl}/api/connections/gmail/callback`,
      grant_type: 'authorization_code',
    }).toString(),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/app/connections?error=gmail_token', appUrl))
  }

  const tokenData = await tokenRes.json()
  const { access_token, refresh_token, expires_in } = tokenData

  if (!refresh_token) {
    // User may have already authorized before — ask them to revoke and reconnect
    return NextResponse.redirect(new URL('/app/connections?error=gmail_no_refresh', appUrl))
  }

  // Get email address from userinfo
  let email = 'gmail'
  try {
    const profileRes = await fetchWithTimeout('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (profileRes.ok) {
      const p = await profileRes.json()
      email = p.email ?? email
    }
  } catch {}

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.redirect(new URL('/sign-in', appUrl))

  const creds = {
    email,
    refreshToken: String(refresh_token),
    accessToken: String(access_token),
    expiresAt: String(Date.now() + Math.min(Math.max(Number(expires_in) || 3600, 60), 86400) * 1000),
  }

  const kvKey = `${user.id}-GMAIL_OAUTH-${randomUUID()}`
  await storeCredentials(kvKey, creds)

  await prisma.connection.upsert({
    where: { userId_platform: { userId: user.id, platform: 'GMAIL_OAUTH' } },
    create: {
      userId: user.id,
      platform: 'GMAIL_OAUTH',
      name: `Gmail — ${email}`,
      kvKey,
      isActive: true,
      lastTestOk: true,
      lastTestedAt: new Date(),
    },
    update: {
      kvKey,
      isActive: true,
      lastTestOk: true,
      lastTestedAt: new Date(),
    },
  })

  const response = NextResponse.redirect(new URL('/app/connections?success=gmail', appUrl))
  // Clear the state cookie
  response.cookies.set('gmail_oauth_state', '', { maxAge: 0, path: '/' })
  return response
}

function parseCookie(header: string, name: string): string | null {
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}
