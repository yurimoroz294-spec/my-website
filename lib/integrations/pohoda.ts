import { parseStringPromise, Builder } from 'xml2js'

export interface PohodaCredentials {
  url: string       // e.g. http://localhost:5336
  username: string
  password: string
  ico: string       // IČO of the company
}

export interface PohodaInvoice {
  id?: string
  number?: string
  variabilniSymbol: string  // variabilní symbol
  ico?: string              // IČO of customer
  dic?: string              // DIČ of customer
  company?: string
  date: string              // YYYY-MM-DD
  dateDue: string
  amount: number
  amountWithVat: number
  vatRate: number           // DPH rate
  currency: string
  items: PohodaInvoiceItem[]
}

export interface PohodaInvoiceItem {
  text: string
  quantity: number
  unitPrice: number
  vatRate: number
  total: number
}

export class PohodaClient {
  private baseUrl: string
  private headers: HeadersInit
  private ico: string

  constructor(creds: PohodaCredentials) {
    this.baseUrl = `${creds.url}/xml`
    this.ico = creds.ico
    this.headers = {
      'Content-Type': 'text/xml; charset=utf-8',
      Authorization: `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString('base64')}`,
      STW_Application: 'CzechDataSync',
      STW_ICO: creds.ico,
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const xml = this.buildRequest('dataPack', `<dataPackItem id="1" version="2.0"><accountingUnit><accountingUnitId>${this.ico}</accountingUnitId></accountingUnit></dataPackItem>`)
      const res = await fetch(this.baseUrl, { method: 'POST', headers: this.headers, body: xml })
      return res.ok
    } catch {
      return false
    }
  }

  async getInvoices(params: { dateFrom?: string; dateTo?: string } = {}): Promise<PohodaInvoice[]> {
    const filter = params.dateFrom
      ? `<filter><selectedCompanyDB><dbId>${this.ico}</dbId></selectedCompanyDB><dateFrom>${params.dateFrom}</dateFrom>${params.dateTo ? `<dateTo>${params.dateTo}</dateTo>` : ''}</filter>`
      : ''

    const xml = this.buildRequest('dataPack', `
      <dataPackItem id="1" version="2.0">
        <lst:listInvoice version="2.0" invoiceType="issuedInvoice" xmlns:lst="http://www.stormware.cz/schema/version_2/list.xsd">
          ${filter}
        </lst:listInvoice>
      </dataPackItem>`)

    const res = await fetch(this.baseUrl, { method: 'POST', headers: this.headers, body: xml })
    if (!res.ok) throw new Error(`Pohoda getInvoices error: ${res.status}`)

    const text = await res.text()
    return this.parseInvoices(text)
  }

  async createInvoice(invoice: PohodaInvoice): Promise<{ id: string }> {
    const itemsXml = invoice.items.map(item => `
      <inv:invoiceItem>
        <inv:text>${this.escapeXml(item.text)}</inv:text>
        <inv:quantity>${item.quantity}</inv:quantity>
        <inv:unit>ks</inv:unit>
        <inv:coefficient>1.0</inv:coefficient>
        <inv:homeCurrency>
          <typ:unitPrice>${item.unitPrice}</typ:unitPrice>
          <typ:price>${item.total}</typ:price>
          <typ:vat>${item.vatRate}</typ:vat>
        </inv:homeCurrency>
      </inv:invoiceItem>`).join('')

    const xml = this.buildRequest('dataPack', `
      <dataPackItem id="1" version="2.0">
        <inv:invoice version="2.0" xmlns:inv="http://www.stormware.cz/schema/version_2/invoice.xsd">
          <inv:invoiceHeader>
            <inv:invoiceType>issuedInvoice</inv:invoiceType>
            <inv:symVar>${this.escapeXml(invoice.variabilniSymbol)}</inv:symVar>
            ${invoice.company ? `<inv:partnerIdentity><per:address xmlns:per="http://www.stormware.cz/schema/version_2/personalAddress.xsd"><per:company>${this.escapeXml(invoice.company)}</per:company>${invoice.ico ? `<per:ico>${invoice.ico}</per:ico>` : ''}${invoice.dic ? `<per:dic>${invoice.dic}</per:dic>` : ''}</per:address></per:partnerIdentity>` : ''}
            <inv:date>${invoice.date}</inv:date>
            <inv:dateDue>${invoice.dateDue}</inv:dateDue>
            <inv:homeCurrency>
              <typ:priceNone xmlns:typ="http://www.stormware.cz/schema/version_2/type.xsd">${invoice.amount}</typ:priceNone>
            </inv:homeCurrency>
          </inv:invoiceHeader>
          <inv:invoiceDetail>${itemsXml}</inv:invoiceDetail>
        </inv:invoice>
      </dataPackItem>`)

    const res = await fetch(this.baseUrl, { method: 'POST', headers: this.headers, body: xml })
    if (!res.ok) throw new Error(`Pohoda createInvoice error: ${res.status}`)
    const text = await res.text()
    const parsed = await parseStringPromise(text)
    const id = parsed?.dataPack?.dataPackItem?.[0]?.['$']?.id ?? 'unknown'
    return { id }
  }

  private buildRequest(rootElement: string, content: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<${rootElement} id="001" ico="${this.ico}" application="CzechDataSync" version="2.0"
  xmlns="http://www.stormware.cz/schema/version_2/data.xsd">
  ${content}
</${rootElement}>`
  }

  private escapeXml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  private async parseInvoices(xml: string): Promise<PohodaInvoice[]> {
    try {
      const parsed = await parseStringPromise(xml)
      const items = parsed?.dataPack?.dataPackItem ?? []
      return items.flatMap((item: any) => {
        const invoices = item?.['lst:listInvoice']?.[0]?.['inv:invoice'] ?? []
        return invoices.map((inv: any) => {
          const h = inv?.['inv:invoiceHeader']?.[0] ?? {}
          return {
            id: h?.['inv:id']?.[0],
            number: h?.['inv:number']?.[0],
            variabilniSymbol: h?.['inv:symVar']?.[0] ?? '',
            date: h?.['inv:date']?.[0] ?? '',
            dateDue: h?.['inv:dateDue']?.[0] ?? '',
            amount: parseFloat(h?.['inv:homeCurrency']?.[0]?.['typ:priceNone']?.[0] ?? '0'),
            amountWithVat: parseFloat(h?.['inv:homeCurrency']?.[0]?.['typ:priceHighSummary']?.[0] ?? '0'),
            vatRate: 21,
            currency: 'CZK',
            items: [],
          } as PohodaInvoice
        })
      })
    } catch {
      return []
    }
  }
}
