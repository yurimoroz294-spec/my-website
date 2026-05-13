import type { ExtractedInvoice } from '@/lib/supabase/types'

const TOKEN_URL = 'https://app.idoklad.cz/identity/server/connect/token'
const API_BASE  = 'https://app.idoklad.cz/api/v3'

interface IDokladConfig {
  clientId: string
  clientSecret: string   // stored as api_secret
}

async function getAccessToken(config: IDokladConfig): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: 'idoklad_api',
    }),
  })
  if (!res.ok) throw new Error(`iDoklad auth failed: ${res.status}`)
  const data = await res.json()
  return data.access_token as string
}

export async function testIDoklad(config: IDokladConfig): Promise<void> {
  const token = await getAccessToken(config)
  const res = await fetch(`${API_BASE}/Company`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`iDoklad: ${res.status}`)
}

export async function pushToIDoklad(
  config: IDokladConfig,
  invoice: ExtractedInvoice,
): Promise<string> {
  const token = await getAccessToken(config)

  const body = {
    DocumentType: 3,                  // 3 = přijatá faktura
    InvoiceNumber: invoice.invoice_number,
    DateOfIssue: invoice.invoice_date,
    DateOfTaxing: invoice.duzp,       // DUZP
    DateOfPayment: invoice.due_date,
    VariableSymbol: invoice.variable_symbol,
    ConstantSymbol: invoice.constant_symbol,
    CurrencyId: 1,                    // 1 = CZK
    Supplier: {
      CompanyName: invoice.supplier_name,
      IdentificationNumber: invoice.supplier_ico,
      VatIdentificationNumber: invoice.supplier_dic,
      Street: invoice.supplier_address,
      City: invoice.supplier_city,
      PostalCode: invoice.supplier_zip,
    },
    Items: (invoice.dph_lines ?? []).map(l => ({
      Name: `Základ DPH ${l.rate}%`,
      Amount: 1,
      Unit: 'ks',
      UnitPrice: l.base,
      VatRateType: l.rate === 21 ? 2 : l.rate === 12 ? 1 : 0,
      PriceType: 0,
    })),
  }

  const res = await fetch(`${API_BASE}/ReceivedInvoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`iDoklad push failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return String(data.Data?.Id ?? data.id)
}
