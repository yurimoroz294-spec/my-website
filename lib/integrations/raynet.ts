import { fetchWithTimeout } from './http'

export interface RaynetCredentials {
  instanceName: string
  apiKey: string
  username: string
}

export interface RaynetCompany {
  id: number
  name: string
  ico?: string   // IČO
  dic?: string   // DIČ
  email?: string
  phone?: string
  rating?: string
}

export interface RaynetLead {
  id: number
  firstName: string
  lastName: string
  email?: string
  phone?: string
  company?: string
}

export interface RaynetOrder {
  id?: number
  title: string
  company: { id: number } | null
  totalAmount: number
  currency: string
  variabilniSymbol?: string // variabilní symbol — Czech payment reference
  items?: RaynetOrderItem[]
}

export interface RaynetOrderItem {
  name: string
  count: number
  unitPrice: number
  tax: number // DPH rate (0, 10, 15, 21)
}

export class RaynetClient {
  private baseUrl: string
  private headers: HeadersInit

  constructor(creds: RaynetCredentials) {
    this.baseUrl = `https://app.raynetcrm.com/api/v2/${creds.instanceName}`
    this.headers = {
      'Content-Type': 'application/json',
      'X-Instance-Name': creds.instanceName,
      Authorization: `Basic ${Buffer.from(`${creds.username}:${creds.apiKey}`).toString('base64')}`,
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/company/?limit=1`, { headers: this.headers })
      return res.ok
    } catch {
      return false
    }
  }

  async getCompanies(limit = 100, offset = 0): Promise<RaynetCompany[]> {
    const res = await fetchWithTimeout(`${this.baseUrl}/company/?limit=${limit}&offset=${offset}`, {
      headers: this.headers,
    })
    if (!res.ok) throw new Error(`RAYNET API error: ${res.status}`)
    const data = await res.json()
    return data.data ?? []
  }

  async findCompanyByIco(ico: string): Promise<RaynetCompany | null> {
    const res = await fetchWithTimeout(`${this.baseUrl}/company/?regNumber=${encodeURIComponent(ico)}`, {
      headers: this.headers,
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data?.[0] ?? null
  }

  async createCompany(company: Partial<RaynetCompany>): Promise<RaynetCompany> {
    const res = await fetchWithTimeout(`${this.baseUrl}/company/`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(company),
    })
    if (!res.ok) throw new Error(`RAYNET createCompany error: ${res.status} ${await res.text()}`)
    const data = await res.json()
    return data.data
  }

  async createOrder(order: RaynetOrder): Promise<{ id: number }> {
    const res = await fetchWithTimeout(`${this.baseUrl}/businessCase/`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        name: order.title,
        company: order.company,
        totalAmount: order.totalAmount,
        currency: order.currency ?? 'CZK',
        customFields: {
          variabilniSymbol: order.variabilniSymbol,
        },
      }),
    })
    if (!res.ok) throw new Error(`RAYNET createOrder error: ${res.status} ${await res.text()}`)
    const data = await res.json()
    return { id: data.data.id }
  }

  async createInvoice(invoiceData: {
    companyId: number
    amount: number
    variabilniSymbol: string
    dphRate: number
    dueDate: string
  }): Promise<{ id: number }> {
    const res = await fetchWithTimeout(`${this.baseUrl}/invoice/`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        company: { id: invoiceData.companyId },
        totalAmount: invoiceData.amount,
        taxRate: invoiceData.dphRate,
        variableSymbol: invoiceData.variabilniSymbol,
        dueDate: invoiceData.dueDate,
      }),
    })
    if (!res.ok) throw new Error(`RAYNET createInvoice error: ${res.status}`)
    const data = await res.json()
    return { id: data.data.id }
  }
}
