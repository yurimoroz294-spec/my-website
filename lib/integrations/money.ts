import { fetchWithTimeout } from './http'

export interface MoneyS3Credentials {
  url: string       // mServer endpoint, e.g. http://localhost:8090
  username: string
  password: string
  ico: string       // IČO of accounting unit
}

export interface MoneyS3Invoice {
  variabilniSymbol: string
  ico?: string
  dic?: string
  company?: string
  date: string         // YYYY-MM-DD
  dateDue: string
  amount: number       // bez DPH
  amountWithVat: number
  vatRate: number
  currency: string
  items?: Array<{ text: string; quantity: number; unitPrice: number; vatRate: number; total: number }>
}

// Money S3 by Solitea uses an XML API via the "mServer" (Money mServer for S3, or REST Money S5).
// We target Money S3 mServer XML format.
export class MoneyS3Client {
  private baseUrl: string
  private headers: HeadersInit
  private ico: string

  constructor(creds: MoneyS3Credentials) {
    this.baseUrl = creds.url.replace(/\/+$/, '')
    this.ico = creds.ico
    this.headers = {
      'Content-Type': 'text/xml; charset=utf-8',
      Authorization: `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString('base64')}`,
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const xml = this.envelope(`<TestMServer/>`)
      const res = await fetchWithTimeout(`${this.baseUrl}/`, { method: 'POST', headers: this.headers, body: xml })
      return res.ok
    } catch {
      return false
    }
  }

  async createInvoice(inv: MoneyS3Invoice): Promise<{ id: string }> {
    const items = (inv.items ?? []).map(it => `
      <Polozka>
        <Popis>${this.x(it.text)}</Popis>
        <Mnozstvi>${this.n(it.quantity)}</Mnozstvi>
        <Cena>${this.n(it.unitPrice)}</Cena>
        <SazbaDPH>${this.n(it.vatRate)}</SazbaDPH>
        <Celkem>${this.n(it.total)}</Celkem>
      </Polozka>`).join('')

    const xml = this.envelope(`
      <FakturaVydana>
        <VariabilniSymbol>${this.x(inv.variabilniSymbol)}</VariabilniSymbol>
        ${inv.company ? `<Odberatel><Nazev>${this.x(inv.company)}</Nazev>${inv.ico ? `<ICO>${this.x(inv.ico)}</ICO>` : ''}${inv.dic ? `<DIC>${this.x(inv.dic)}</DIC>` : ''}</Odberatel>` : ''}
        <DatumVystaveni>${this.x(inv.date)}</DatumVystaveni>
        <DatumSplatnosti>${this.x(inv.dateDue)}</DatumSplatnosti>
        <CelkemBezDPH>${this.n(inv.amount)}</CelkemBezDPH>
        <CelkemSDPH>${this.n(inv.amountWithVat)}</CelkemSDPH>
        <SazbaDPH>${this.n(inv.vatRate)}</SazbaDPH>
        <Mena>${this.x(inv.currency)}</Mena>
        <Polozky>${items}</Polozky>
      </FakturaVydana>`)

    const res = await fetchWithTimeout(`${this.baseUrl}/`, { method: 'POST', headers: this.headers, body: xml })
    if (!res.ok) throw new Error(`Money S3 createInvoice error: ${res.status}`)

    const text = await res.text()
    const idMatch = text.match(/<ID>([^<]+)<\/ID>/)
    return { id: idMatch?.[1] ?? 'unknown' }
  }

  private envelope(content: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<MoneyData ico="${this.x(this.ico)}" application="CzechDataSync">
  ${content}
</MoneyData>`
  }

  private x(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  }

  private n(v: number): string {
    const num = Number(v)
    if (!Number.isFinite(num)) throw new Error(`Invalid numeric value: ${v}`)
    return num.toString()
  }
}
