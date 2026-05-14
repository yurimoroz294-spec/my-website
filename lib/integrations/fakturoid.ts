import { fetchWithTimeout } from './http'

export interface FakturoidCredentials {
  slug: string      // account name in fakturoid URL
  email: string
  apiKey: string
}

export interface FakturoidInvoice {
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

// Fakturoid REST API v3: https://www.fakturoid.cz/api/v3
// Auth: Basic with email + API key. User-Agent header required.
export class FakturoidClient {
  private baseUrl: string
  private headers: HeadersInit

  constructor(creds: FakturoidCredentials) {
    this.baseUrl = `https://app.fakturoid.cz/api/v3/accounts/${encodeURIComponent(creds.slug)}`
    this.headers = {
      Authorization: `Basic ${Buffer.from(`${creds.email}:${creds.apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'User-Agent': 'CzechDataSync (info@czechdatasync.cz)',
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/account.json`, { headers: this.headers })
      return res.ok
    } catch {
      return false
    }
  }

  async createInvoice(inv: FakturoidInvoice): Promise<{ id: string }> {
    // Fakturoid requires a subject_id (customer record).
    // First try to find an existing subject by registration_no (IČO), or create one.
    let subjectId: number | null = null
    if (inv.ico) {
      const found = await this.findSubjectByIco(inv.ico)
      subjectId = found ?? await this.createSubject({
        name: inv.company ?? inv.ico,
        registration_no: inv.ico,
        vat_no: inv.dic ?? undefined,
      })
    } else if (inv.company) {
      subjectId = await this.createSubject({ name: inv.company })
    }

    if (!subjectId) throw new Error('Faktura nemá IČO ani název firmy — nelze vytvořit subjekt.')

    const lines = inv.items?.length
      ? inv.items.map(it => ({
          name: it.text,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          vat_rate: it.vatRate,
        }))
      : [{
          name: `Faktura ${inv.variabilniSymbol}`,
          quantity: 1,
          unit_price: inv.amount,
          vat_rate: inv.vatRate,
        }]

    const body = {
      subject_id: subjectId,
      variable_symbol: inv.variabilniSymbol,
      issued_on: inv.date,
      due_on: inv.dateDue,
      currency: inv.currency,
      lines,
    }

    const res = await fetchWithTimeout(`${this.baseUrl}/invoices.json`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Fakturoid createInvoice ${res.status}: ${err}`)
    }
    const data = await res.json()
    return { id: String(data?.id ?? 'unknown') }
  }

  private async findSubjectByIco(ico: string): Promise<number | null> {
    const res = await fetchWithTimeout(
      `${this.baseUrl}/subjects/search.json?query=${encodeURIComponent(ico)}`,
      { headers: this.headers },
    )
    if (!res.ok) return null
    const data = await res.json()
    const list = Array.isArray(data) ? data : []
    const match = list.find((s: any) => s.registration_no === ico)
    return match?.id ?? null
  }

  private async createSubject(data: { name: string; registration_no?: string; vat_no?: string }): Promise<number> {
    const res = await fetchWithTimeout(`${this.baseUrl}/subjects.json`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Fakturoid createSubject ${res.status}: ${err}`)
    }
    const json = await res.json()
    const id = Number(json?.id)
    if (!Number.isFinite(id) || id <= 0) throw new Error('Fakturoid vrátil neplatné ID subjektu.')
    return id
  }
}
