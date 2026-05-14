import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import { randomBytes } from 'crypto'

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'email',
].join(' ')

export async function GET() {
  const clerkId = await getAuthUserId()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  if (!clerkId) {
    return NextResponse.redirect(new URL('/sign-in', appUrl))
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.redirect(new URL('/app/connections?error=google_not_configured', appUrl))
  }

  const state = randomBytes(16).toString('hex')

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${appUrl}/api/connections/gmail/callback`,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',  // always request refresh_token
    state,
  })

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  )

  response.cookies.set('gmail_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return response
}
