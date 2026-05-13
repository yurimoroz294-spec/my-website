import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testImapConnection } from '@/lib/email/imap'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    host: string; port: number; username: string; password: string; useSSL: boolean
  }
  const { host, port, username, password, useSSL } = body

  if (!host || !port || !username || !password) {
    return NextResponse.json({ error: 'Vyplňte všechna pole.' }, { status: 400 })
  }

  try {
    await testImapConnection({ host, port, username, password, useSSL: useSSL ?? true })
  } catch {
    return NextResponse.json({ error: 'Nepodařilo se připojit k IMAP serveru. Zkontrolujte údaje.' }, { status: 400 })
  }

  const provider = host.includes('seznam') ? 'seznam' : 'imap'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('email_connections') as any).upsert(
    {
      user_id: user.id,
      provider,
      email_address: username,
      imap_host: host,
      imap_port: port,
      imap_username: username,
      imap_password: password,
      imap_use_ssl: useSSL ?? true,
      is_active: true,
      is_verified: true,
    },
    { onConflict: 'user_id,email_address' },
  )

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
