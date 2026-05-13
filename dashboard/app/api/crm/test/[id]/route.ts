import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testFakturoid } from '@/lib/crm/fakturoid'
import { testIDoklad } from '@/lib/crm/idoklad'
import type { CrmConnection } from '@/lib/supabase/types'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn } = await (supabase.from('crm_connections') as any)
    .select('*').eq('id', id).eq('user_id', user.id).single()

  if (!conn) return NextResponse.json({ error: 'Nenalezeno.' }, { status: 404 })

  const c = conn as CrmConnection
  try {
    if (c.crm_type === 'fakturoid') {
      await testFakturoid({ apiKey: c.api_key!, slug: c.fakturoid_slug!, userEmail: c.api_url! })
    } else if (c.crm_type === 'idoklad') {
      await testIDoklad({ clientId: c.idoklad_client_id!, clientSecret: c.api_secret! })
    } else if (c.crm_type === 'pohoda') {
      if (c.pohoda_version !== 'mserver') {
        return NextResponse.json({ ok: true, message: 'Pohoda XML – test není potřeba.' })
      }
      const res = await fetch(`${c.api_url}/ine`, {
        headers: { Authorization: `Basic ${Buffer.from(`:${c.api_key}`).toString('base64')}` },
      })
      if (!res.ok && res.status !== 404) throw new Error(`Pohoda: ${res.status}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('crm_connections') as any)
      .update({ last_used_at: new Date().toISOString(), is_verified: true })
      .eq('id', id)

    return NextResponse.json({ ok: true, message: 'Připojení funguje.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Test selhal.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
