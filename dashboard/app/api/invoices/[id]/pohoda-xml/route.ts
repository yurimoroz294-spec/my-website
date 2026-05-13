import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPohodaXml } from '@/lib/crm/pohoda'
import type { Invoice, Profile } from '@/lib/supabase/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: invData }, { data: profileData }] = await Promise.all([
    (supabase.from('invoices') as any).select('*').eq('id', id).eq('user_id', user.id).single(),
    (supabase.from('profiles') as any).select('ico').eq('id', user.id).single(),
  ])

  if (!invData) return new NextResponse('Faktura nenalezena.', { status: 404 })

  const inv = invData as Invoice
  const profile = profileData as Pick<Profile, 'ico'> | null
  const userIco = profile?.ico ?? '00000000'

  const xml = buildPohodaXml(
    {
      supplier_name:     inv.supplier_name,
      supplier_ico:      inv.supplier_ico,
      supplier_dic:      inv.supplier_dic,
      supplier_address:  inv.supplier_address,
      supplier_city:     inv.supplier_city,
      supplier_zip:      inv.supplier_zip,
      invoice_number:    inv.invoice_number,
      invoice_date:      inv.invoice_date,
      duzp:              inv.duzp,
      due_date:          inv.due_date,
      currency:          inv.currency,
      amount_without_vat: inv.amount_without_vat,
      vat_amount:        inv.vat_amount,
      amount_total:      inv.amount_total,
      dph_lines:         (inv.dph_lines as { rate: number; base: number; vat_amount: number }[]) ?? [],
      variable_symbol:   inv.variable_symbol,
      constant_symbol:   inv.constant_symbol,
      specific_symbol:   inv.specific_symbol,
      bank_account_cz:   inv.bank_account_cz,
      iban:              inv.iban,
      swift:             inv.swift,
      payment_method:    inv.payment_method,
    },
    userIco,
  )

  const filename = `pohoda-${inv.invoice_number ?? inv.id}.xml`
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'text/xml; charset=Windows-1250',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
