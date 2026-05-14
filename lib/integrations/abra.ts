import { fetchWithTimeout } from './http'

export interface AbraFlexiCredentials {
  url: string       // e.g. https://demo.flexibee.eu (no trailing slash)
  company: string   // company code in ABRA Flexi
  username: string
  password: string
}

export interface AbraFlexiInvoice {
  variabilniSymbol: string
  ico?: string
  dic?: string
  company?: string
  date: string
  dateDue: string
  amount: number
  amountWithVat: number
  vatRate: number
  currency: string
  items?: Array<{ text: string; quantity: number; unitPrice: number; vatRate: number }>
}

// ABRA Flexi REST API: PUT /c/{company}/faktura-vydana.json
// Docs: https://www.flexibee.eu/api/dokumentace/
export class AbraFlexiClient {
  private baseUrl: string
  private headers: HeadersInit

  constructor(creds: AbraFlexiCredentials) {
    this.baseUrl = `${creds.url.replace(/\/+$/, '')}/c/${encodeURIComponent(creds.company)}`
    this.headers = {
      Authorization: `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString('base64')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}.json`, { headers: this.headers })
      return res.ok
    } catch {
      return false
    }
  }

  async createInvoice(inv: AbraFlexiInvoice): Promise<{ id: string }> {
    const items = (inv.items ?? []).map(it => ({
      nazev: it.text,
      mnozMj: it.quantity,
      cenaMj: it.unitPrice,
      typCenyDphK: 'typCeny.bezDph',
    }))

    const invoiceData: Record<string, unknown> = {
      typDokl: 'code:FAKTURA',
      varSym: inv.variabilniSymbol,
      datVyst: inv.date,
      datSplat: inv.dateDue,
      sumZklZakl: inv.amount,
      sumCelkem: inv.amountWithVat,
      mena: `code:${inv.currency}`,
    }

    if (items.length) invoiceData['polozkyFaktury'] = items

    if (inv.ico) {
      // ABRA Flexi can link to existing address book entry by IČO using "extId"-like reference
      invoiceData['firma'] = `code:${inv.ico}`
      invoiceData['nazFirmy'] = inv.company ?? inv.ico
      invoiceData['ic'] = inv.ico
      if (inv.dic) invoiceData['dic'] = inv.dic
    } else if (inv.company) {
      invoiceData['nazFirmy'] = inv.company
    }

    const body = { winstrom: { 'faktura-vydana': invoiceData } }

    const res = await fetchWithTimeout(`${this.baseUrl}/faktura-vydana.json`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`ABRA Flexi createInvoice ${res.status}: ${err}`)
    }
    const data = await res.json()
    const id = data?.winstrom?.results?.[0]?.id ?? data?.winstrom?.results?.[0]?.ref ?? 'unknown'
    return { id: String(id) }
  }
}
