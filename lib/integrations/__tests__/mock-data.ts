import type { ShoptetOrder } from '../shoptet'
import type { RaynetCompany, RaynetOrder } from '../raynet'
import type { PohodaInvoice } from '../pohoda'
import type { PacketaPacket } from '../packeta'

export const MOCK_SHOPTET_ORDER: ShoptetOrder = {
  code: 'OBJ-2024-001234',
  status: 'paid',
  creationTime: '2024-06-15T10:30:00Z',
  email: 'jan.novak@firma.cz',
  phone: '+420 776 123 456',
  billing: {
    fullName: 'Jan Novák',
    company: 'Firma s.r.o.',
    ico: '12345678',
    dic: 'CZ12345678',
    street: 'Wenceslas Square 1',
    city: 'Praha',
    zip: '110 00',
    country: 'CZ',
  },
  items: [
    { name: 'Produkt A', amount: 2, unitPrice: 1500, vatRate: 21, code: 'PROD-A' },
    { name: 'Produkt B', amount: 1, unitPrice: 3200, vatRate: 21, code: 'PROD-B' },
  ],
  totalPriceWithVat: 7502,
  currency: 'CZK',
  variableSymbol: '2024001234',
  note: 'Prosím doručit do 17:00',
}

export const MOCK_RAYNET_COMPANY: RaynetCompany = {
  id: 98765,
  name: 'Firma s.r.o.',
  ico: '12345678',
  dic: 'CZ12345678',
  email: 'info@firma.cz',
  phone: '+420 776 123 456',
  rating: 'A',
}

export const MOCK_POHODA_INVOICE: PohodaInvoice = {
  id: 'INV-2024-0056',
  number: '2024056',
  variabilniSymbol: '2024056',
  ico: '87654321',
  dic: 'CZ87654321',
  company: 'Odběratel s.r.o.',
  date: '2024-06-15',
  dateDue: '2024-06-29',
  amount: 15000,
  amountWithVat: 18150,
  vatRate: 21,
  currency: 'CZK',
  items: [
    { text: 'Poradenství červen 2024', quantity: 1, unitPrice: 15000, vatRate: 21, total: 15000 },
  ],
}

export const MOCK_PACKETA_PACKET: PacketaPacket = {
  id: 'Z123456789',
  barcode: 'Z123456789',
  trackingUrl: 'https://tracking.packeta.com/cs/?id=Z123456789',
  status: 'delivered',
  statusDate: '2024-06-16T14:22:00Z',
  recipientName: 'Jan Novák',
  recipientEmail: 'jan.novak@firma.cz',
  weight: 1.5,
  cod: 0,
  currency: 'CZK',
}

// Czech-specific field validation helpers
export function isValidIco(ico: string): boolean {
  if (!/^\d{8}$/.test(ico)) return false
  const digits = ico.split('').map(Number)
  const weights = [8, 7, 6, 5, 4, 3, 2]
  const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0)
  const remainder = (11 - (sum % 11)) % 10
  return remainder === digits[7]
}

export function isValidDic(dic: string): boolean {
  return /^CZ\d{8,10}$/.test(dic)
}

export function isValidVariabilniSymbol(vs: string): boolean {
  return /^\d{1,10}$/.test(vs)
}
