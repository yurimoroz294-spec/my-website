import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testImapConnection } from '@/lib/email/imap'
import { refreshAccessToken } from '@/lib/email/gmail'
import type { EmailConnection } from '@/lib/supabase/types'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn } = await (supabase.from('email_connections') as any)
    .select('*').eq('id', id).eq('user_id', user.id).single()

  if (!conn) return NextResponse.json({ error: 'Připojení nenalezeno.' }, { status: 404 })

  const c = conn as EmailConnection
  try {
    if (c.provider === 'gmail') {
      if (!c.refresh_token) throw new Error('Chybí refresh token, znovu se připojte přes Gmail.')
      await refreshAccessToken(c.refresh_token)
    } else {
      await testImapConnection({
        host: c.imap_host!,
        port: c.imap_port!,
        username: c.imap_username!,
        password: c.imap_password!,
        useSSL: c.imap_use_ssl,
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('email_connections') as any)
      .update({ last_checked_at: new Date().toISOString(), is_verified: true })
      .eq('id', id)

    return NextResponse.json({ ok: true, message: 'Připojení funguje.' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Test selhal.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
