import type { ExtractedInvoice } from '@/lib/supabase/types'

const BASE = 'https://app.fakturoid.cz/api/v3/accounts'

interface FakturoidConfig {
  apiKey: string      // Fakturoid API key
  slug: string        // account slug (url segment)
  userEmail: string   // email of authenticated user (used as HTTP Basic username)
}

export async function testFakturoid(config: FakturoidConfig): Promise<void> {
  const res = await fetch(`${BASE}/${config.slug}/account.json`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.userEmail}:${config.apiKey}`).toString('base64')}`,
      'User-Agent': 'NexAI-InvoiceBot/1.0',
    },
  })
  if (!res.ok) throw new Error(`Fakturoid: ${res.status} ${await res.text()}`)
}

export async function pushToFakturoid(
  config: FakturoidConfig,
  invoice: ExtractedInvoice,
): Promise<string> {
  const body = {
    document_type: 'bill',           // přijatá faktura
    status: 'open',
    due: invoice.due_date,
    taxable_fulfillment_due: invoice.duzp,
    number: invoice.invoice_number,
    variable_symbol: invoice.variable_symbol,
    constant_symbol: invoice.constant_symbol,
    currency: invoice.currency ?? 'CZK',
    supplier_name: invoice.supplier_name,
    supplier_registration_no: invoice.supplier_ico,
    supplier_vat_no: invoice.supplier_dic,
    supplier_street: invoice.supplier_address,
    supplier_city: invoice.supplier_city,
    supplier_zip: invoice.supplier_zip,
    bank_account: invoice.bank_account_cz,
    iban: invoice.iban,
    swift_bic: invoice.swift,
    lines: (invoice.dph_lines ?? []).map(l => ({
      quantity: 1,
      unit_name: 'ks',
      unit_price: l.base,
      vat_rate: l.rate,
      name: `Základ DPH ${l.rate}%`,
    })),
  }

  const res = await fetch(`${BASE}/${config.slug}/expenses.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${config.userEmail}:${config.apiKey}`).toString('base64')}`,
      'User-Agent': 'NexAI-InvoiceBot/1.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Fakturoid push failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return String(data.id)
}
