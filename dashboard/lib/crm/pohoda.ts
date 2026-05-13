import type { ExtractedInvoice } from '@/lib/supabase/types'

// Pohoda XML import format (supports both Pohoda XML and mServer REST)
// Primary: generate importable XML for Pohoda
// mServer: POST via HTTP if pohoda_version === 'mserver'

export function buildPohodaXml(invoice: ExtractedInvoice, userIco: string): string {
  const date = (d: string | null) => d ?? ''
  const num  = (n: number | null) => (n ?? 0).toFixed(2)

  const vatLines = (invoice.dph_lines ?? [])
    .map(l => `
    <typ:${rateKey(l.rate)}>
      <typ:zaklad>${num(l.base)}</typ:zaklad>
      <typ:dph>${num(l.vat_amount)}</typ:dph>
    </typ:${rateKey(l.rate)}>`)
    .join('')

  return `<?xml version="1.0" encoding="Windows-1250"?>
<dat:dataPack
  id="NexAI"
  ico="${userIco}"
  application="NexAI"
  version="2.0"
  note="Import faktury"
  xmlns:dat="http://www.stormware.cz/schema/version_2/data.xsd"
  xmlns:fak="http://www.stormware.cz/schema/version_2/invoice.xsd"
  xmlns:typ="http://www.stormware.cz/schema/version_2/type.xsd"
>
  <dat:dataPackItem id="1" version="2.0">
    <fak:invoice version="2.0">
      <fak:invoiceHeader>
        <fak:invoiceType>receivedInvoice</fak:invoiceType>
        <fak:number>
          <typ:numberRequested>${invoice.invoice_number ?? ''}</typ:numberRequested>
        </fak:number>
        <fak:date>${date(invoice.invoice_date)}</fak:date>
        <fak:dateTax>${date(invoice.duzp)}</fak:dateTax>
        <fak:dateDue>${date(invoice.due_date)}</fak:dateDue>
        <fak:partnerIdentity>
          <typ:address>
            <typ:company>${esc(invoice.supplier_name ?? '')}</typ:company>
            <typ:ico>${invoice.supplier_ico ?? ''}</typ:ico>
            <typ:dic>${invoice.supplier_dic ?? ''}</typ:dic>
            <typ:street>${esc(invoice.supplier_address ?? '')}</typ:street>
            <typ:city>${esc(invoice.supplier_city ?? '')}</typ:city>
            <typ:zip>${invoice.supplier_zip ?? ''}</typ:zip>
          </typ:address>
        </fak:partnerIdentity>
        <fak:paymentType>
          <typ:paymentType>${invoice.payment_method === 'hotovost' ? 'cash' : 'transfer'}</typ:paymentType>
        </fak:paymentType>
        <fak:symVar>${invoice.variable_symbol ?? ''}</fak:symVar>
        <fak:symConst>${invoice.constant_symbol ?? ''}</fak:symConst>
        <fak:account>
          <typ:accountNo>${czAccountNo(invoice.bank_account_cz)}</typ:accountNo>
          <typ:bankCode>${czBankCode(invoice.bank_account_cz)}</typ:bankCode>
          <typ:iban>${invoice.iban ?? ''}</typ:iban>
          <typ:swift>${invoice.swift ?? ''}</typ:swift>
        </fak:account>
        <fak:homeCurrency>
          <typ:priceNone>0.00</typ:priceNone>
          <typ:priceLow>0.00</typ:priceLow>
          <typ:priceHighSum>${num(invoice.amount_without_vat)}</typ:priceHighSum>
          <typ:round><typ:priceRound>0.00</typ:priceRound></typ:round>
        </fak:homeCurrency>
      </fak:invoiceHeader>
      <fak:invoiceSummary>
        <fak:homeCurrency>
          ${vatLines}
          <typ:round><typ:priceRound>0.00</typ:priceRound></typ:round>
        </fak:homeCurrency>
      </fak:invoiceSummary>
    </fak:invoice>
  </dat:dataPackItem>
</dat:dataPack>`
}

// POST XML to Pohoda mServer
export async function pushToPohodaMserver(
  apiUrl: string,
  apiKey: string,
  invoice: ExtractedInvoice,
  userIco: string,
): Promise<string> {
  const xml = buildPohodaXml(invoice, userIco)
  const res = await fetch(`${apiUrl}/xml`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=Windows-1250',
      Authorization: `Basic ${Buffer.from(`:${apiKey}`).toString('base64')}`,
      'STW-Application': 'NexAI',
    },
    body: xml,
  })
  if (!res.ok) throw new Error(`Pohoda mServer: ${res.status} ${await res.text()}`)
  const text = await res.text()
  // Extract response ID from XML response
  const match = text.match(/id="([^"]+)"/)
  return match?.[1] ?? 'ok'
}

// --- helpers ---

function rateKey(rate: number): string {
  if (rate === 21) return 'highRate'
  if (rate === 12) return 'lowRate'
  return 'zeroRate'
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function czAccountNo(account: string | null): string {
  if (!account) return ''
  const parts = account.split('/')
  return parts[0] ?? ''
}

function czBankCode(account: string | null): string {
  if (!account) return ''
  return account.split('/')[1] ?? ''
}
