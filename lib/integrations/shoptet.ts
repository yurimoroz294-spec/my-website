import { fetchWithTimeout } from './http'

export interface ShoptetCredentials {
  apiKey: string
  eshopId: string
}

export interface ShoptetOrder {
  code: string
  status: string
  creationTime: string
  email: string
  phone?: string
  billing: {
    fullName: string
    company?: string
    ico?: string    // IČO
    dic?: string    // DIČ
    street: string
    city: string
    zip: string
    country: string
  }
  items: ShoptetOrderItem[]
  totalPriceWithVat: number
  currency: string
  variableSymbol?: string // variabilní symbol
  note?: string
}

export interface ShoptetOrderItem {
  name: string
  amount: number
  unitPrice: number
  vatRate: number // DPH %
  code?: string
}

export interface ShoptetProduct {
  guid: string
  name: string
  code: string
  stockQuantity: number
  price: number
  vat: number
}

export class ShoptetClient {
  private baseUrl: string
  private headers: HeadersInit

  constructor(creds: ShoptetCredentials) {
    this.baseUrl = 'https://api.shoptet.com/api/v1'
    this.headers = {
      'Content-Type': 'application/json',
      'Shoptet-Access-Token': creds.apiKey,
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/eshop`, { headers: this.headers })
      return res.ok
    } catch {
      return false
    }
  }

  async getOrders(params: {
    from?: string
    to?: string
    status?: string
    page?: number
  } = {}): Promise<ShoptetOrder[]> {
    const query = new URLSearchParams()
    if (params.from) query.set('creationTimeFrom', params.from)
    if (params.to) query.set('creationTimeTo', params.to)
    if (params.status) query.set('statusCode', params.status)
    query.set('page', String(params.page ?? 1))

    const res = await fetchWithTimeout(`${this.baseUrl}/orders?${query}`, { headers: this.headers })
    if (!res.ok) throw new Error(`Shoptet getOrders error: ${res.status}`)
    const data = await res.json()
    return data.data?.orders ?? []
  }

  async getOrder(code: string): Promise<ShoptetOrder> {
    const res = await fetchWithTimeout(`${this.baseUrl}/orders/${code}`, { headers: this.headers })
    if (!res.ok) throw new Error(`Shoptet getOrder error: ${res.status}`)
    const data = await res.json()
    return data.data
  }

  async updateOrderStatus(code: string, statusCode: string): Promise<void> {
    const res = await fetchWithTimeout(`${this.baseUrl}/orders/${code}/status`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify({ statusCode }),
    })
    if (!res.ok) throw new Error(`Shoptet updateOrderStatus error: ${res.status}`)
  }

  async getProducts(page = 1): Promise<ShoptetProduct[]> {
    const res = await fetchWithTimeout(`${this.baseUrl}/products?page=${page}`, { headers: this.headers })
    if (!res.ok) throw new Error(`Shoptet getProducts error: ${res.status}`)
    const data = await res.json()
    return data.data?.products ?? []
  }

  async updateStock(guid: string, quantity: number): Promise<void> {
    const res = await fetchWithTimeout(`${this.baseUrl}/products/${guid}/stock`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify({ stockQuantity: quantity }),
    })
    if (!res.ok) throw new Error(`Shoptet updateStock error: ${res.status}`)
  }
}
