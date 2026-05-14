import { fetchWithTimeout } from './http'

export interface IDokladCredentials {
  clientId: string
  clientSecret: string
}

export interface IDokladInvoice {
  variabilniSymbol: string
  ico?: string
  dic?: string
  company?: string
  date: string         // YYYY-MM-DD
  dateDue: string
  amount: number
  amountWithVat: number
  vatRate: number
  currency: string
  items?: Array<{ text: string; quantity: number; unitPrice: number; vatRate: number }>
}

// iDoklad uses OAuth 2.0 Client Credentials grant.
// Docs: https://api.idoklad.cz/Help
export class IDokladClient {
  private apiUrl = 'https://api.idoklad.cz/v3'
  private tokenUrl = 'https://identity.idoklad.cz/server/connect/token'
  private creds: IDokladCredentials
  private accessToken: string | null = null
  private tokenExpiresAt = 0

  constructor(creds: IDokladCredentials) {
    this.creds = creds
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getToken()
      const res = await fetchWithTimeout(`${this.apiUrl}/Agendas`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      })
      return res.ok
    } catch {
      return false
    }
  }

  async createInvoice(inv: IDokladInvoice): Promise<{ id: string }> {
    await this.getToken()

    // iDoklad expects items as an array; provide a fallback single-line invoice
    // if no item breakdown is available (common with AI-parsed PDFs).
    const items = inv.items?.length
      ? inv.items.map(it => ({
          Name: it.text,
          Amount: it.quantity,
          UnitPrice: it.unitPrice,
          VatRateType: this.mapVatRate(it.vatRate),
        }))
      : [{
          Name: `Faktura ${inv.variabilniSymbol}`,
          Amount: 1,
          UnitPrice: inv.amount,
          VatRateType: this.mapVatRate(inv.vatRate),
        }]

    const body = {
      VariableSymbol: inv.variabilniSymbol,
      DateOfIssue: inv.date,
      DateOfMaturity: inv.dateDue,
      CurrencyId: this.currencyId(inv.currency),
      PartnerContact: inv.company ? {
        CompanyName: inv.company,
        IdentificationNumber: inv.ico,
        VatIdentificationNumber: inv.dic,
      } : undefined,
      Items: items,
    }

    const res = await fetchWithTimeout(`${this.apiUrl}/IssuedInvoices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`iDoklad createInvoice ${res.status}: ${err}`)
    }
    const data = await res.json()
    return { id: String(data?.Id ?? 'unknown') }
  }

  private async getToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) return

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.creds.clientId,
      client_secret: this.creds.clientSecret,
      scope: 'idoklad_api',
    })

    const res = await fetchWithTimeout(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    if (!res.ok) throw new Error(`iDoklad token error: ${res.status}`)
    const data = await res.json()
    if (!data.access_token) throw new Error('iDoklad vrátil prázdný access token. Zkontrolujte Client ID a Client Secret.')
    this.accessToken = data.access_token
    const expiresIn = Math.min(Math.max(Number(data.expires_in) || 3600, 60), 86400)
    this.tokenExpiresAt = Date.now() + expiresIn * 1000
  }

  // iDoklad VAT rate enum: 0=basic(21), 1=reduced1(12/15), 2=reduced2(10), 3=zero
  private mapVatRate(rate: number): number {
    if (rate >= 20) return 0
    if (rate >= 12) return 1
    if (rate >= 1) return 2
    return 3
  }

  private currencyId(code: string): number {
    // iDoklad currency IDs: 1=CZK, 2=EUR, 3=USD (most common)
    switch (code?.toUpperCase()) {
      case 'EUR': return 2
      case 'USD': return 3
      default:    return 1
    }
  }
}
