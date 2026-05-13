export interface PacketaCredentials {
  apiKey: string
  apiPassword: string
}

export interface PacketaPacket {
  id: string
  barcode: string
  trackingUrl: string
  status: PacketaStatus
  statusDate: string
  recipientName: string
  recipientEmail?: string
  weight?: number
  cod?: number       // dobírka (cash on delivery) in CZK
  currency?: string
}

export type PacketaStatus =
  | 'received'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'dispatched'
  | 'delivered'
  | 'returned'
  | 'cancelled'

export interface PacketaCreateParams {
  number: string        // order number
  name: string
  surname: string
  email?: string
  phone?: string
  addressId: number     // Packeta pickup point ID
  cod?: number          // dobírka CZK
  value: number         // declared value
  weight?: number
  currency?: string
  eshop: string         // your eshop name in Packeta
}

export class PacketaClient {
  private apiUrl = 'https://www.zasilkovna.cz/api/rest'
  private creds: PacketaCredentials

  constructor(creds: PacketaCredentials) {
    this.creds = creds
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await this.call('packetStatus', { apiPassword: this.creds.apiPassword, id: 'test' })
      return res !== null
    } catch {
      return false
    }
  }

  async getPacketStatus(packetId: string): Promise<PacketaPacket | null> {
    const data = await this.call('packetTracking', {
      apiPassword: this.creds.apiPassword,
      id: packetId,
    })
    if (!data) return null

    return {
      id: packetId,
      barcode: data.barcode ?? '',
      trackingUrl: `https://tracking.packeta.com/cs/?id=${packetId}`,
      status: data.statusCode as PacketaStatus,
      statusDate: data.dateTime ?? new Date().toISOString(),
      recipientName: data.recipientName ?? '',
    }
  }

  async getPacketsByOrderNumbers(orderNumbers: string[]): Promise<Map<string, PacketaPacket>> {
    const result = new Map<string, PacketaPacket>()
    await Promise.allSettled(
      orderNumbers.map(async (num) => {
        const packet = await this.getPacketStatus(num)
        if (packet) result.set(num, packet)
      })
    )
    return result
  }

  async createPacket(params: PacketaCreateParams): Promise<{ id: string; barcode: string }> {
    const data = await this.call('createPacket', {
      apiPassword: this.creds.apiPassword,
      packetAttributes: {
        number: params.number,
        name: params.name,
        surname: params.surname,
        email: params.email,
        phone: params.phone,
        addressId: params.addressId,
        cod: params.cod ?? 0,
        value: params.value,
        weight: params.weight ?? 1,
        currency: params.currency ?? 'CZK',
        eshop: params.eshop,
      },
    })
    return { id: data.id, barcode: data.barcode }
  }

  private async call(method: string, params: Record<string, unknown>): Promise<any> {
    const soap = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.zasilkovna.cz/api/soap.wsdl2">
  <SOAP-ENV:Body>
    <ns1:${method}>
      <apiKey>${this.creds.apiKey}</apiKey>
      ${Object.entries(params).map(([k, v]) =>
        typeof v === 'object'
          ? `<${k}>${Object.entries(v as Record<string, unknown>).map(([kk, vv]) => `<${kk}>${vv ?? ''}</${kk}>`).join('')}</${k}>`
          : `<${k}>${v}</${k}>`
      ).join('')}
    </ns1:${method}>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`

    const res = await fetch(`${this.apiUrl}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: method },
      body: soap,
    })
    if (!res.ok) throw new Error(`Packeta ${method} error: ${res.status}`)
    const { parseStringPromise } = await import('xml2js')
    const text = await res.text()
    const parsed = await parseStringPromise(text, { explicitArray: false })
    return parsed?.['SOAP-ENV:Envelope']?.['SOAP-ENV:Body']?.[`ns1:${method}Response`]?.return ?? null
  }
}
