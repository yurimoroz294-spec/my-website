import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testFakturoid } from '@/lib/crm/fakturoid'
import { testIDoklad } from '@/lib/crm/idoklad'
import type { CrmType } from '@/lib/supabase/types'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    crm_type: CrmType
    display_name: string
    api_key?: string
    api_url?: string
    api_secret?: string
    pohoda_version?: string
    pohoda_ico?: string
    fakturoid_slug?: string
    fakturoid_user_email?: string
    idoklad_client_id?: string
  }

  // Verify connection before saving
  try {
    if (body.crm_type === 'fakturoid') {
      await testFakturoid({
        apiKey: body.api_key!,
        slug: body.fakturoid_slug!,
        userEmail: body.fakturoid_user_email!,
      })
    } else if (body.crm_type === 'idoklad') {
      await testIDoklad({
        clientId: body.idoklad_client_id!,
        clientSecret: body.api_secret!,
      })
    } else if (body.crm_type === 'pohoda' && body.pohoda_version === 'mserver') {
      const res = await fetch(`${body.api_url}/ine`, {
        headers: { Authorization: `Basic ${Buffer.from(`:${body.api_key}`).toString('base64')}` },
      })
      if (!res.ok && res.status !== 404) throw new Error(`Pohoda mServer: ${res.status}`)
    }
    // money_s3, raynet, pohoda-xml: no live test
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Test připojení selhal.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('crm_connections') as any).insert({
    user_id: user.id,
    crm_type: body.crm_type,
    display_name: body.display_name,
    api_key: body.api_key ?? null,
    api_url: body.fakturoid_user_email ?? body.api_url ?? null, // Fakturoid uses api_url for email
    api_secret: body.api_secret ?? null,
    pohoda_version: body.pohoda_version ?? null,
    pohoda_ico: body.pohoda_ico ?? null,
    fakturoid_slug: body.fakturoid_slug ?? null,
    idoklad_client_id: body.idoklad_client_id ?? null,
    is_verified: body.crm_type !== 'pohoda' || body.pohoda_version === 'mserver',
    is_active: true,
  })

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
