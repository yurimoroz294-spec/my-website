import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { exchangeCode } from '@/lib/email/gmail'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')

  if (!code || !userId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections/email?error=missing_params`)
  }

  try {
    const { access_token, refresh_token, token_expiry, email } = await exchangeCode(code)
    const supabase = await createServiceClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('email_connections') as any).upsert(
      {
        user_id: userId,
        provider: 'gmail',
        email_address: email,
        access_token,
        refresh_token,
        token_expiry,
        is_active: true,
        is_verified: true,
      },
      { onConflict: 'user_id,email_address' },
    )

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections/email?success=gmail`)
  } catch (err) {
    console.error('Gmail OAuth callback error:', err)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections/email?error=oauth_failed`)
  }
}
