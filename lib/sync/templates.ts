export interface SyncTemplate {
  id: string
  name: string
  description: string
  source: 'RAYNET' | 'SHOPTET' | 'POHODA' | 'PACKETA' | 'AIRTABLE'
  target: 'RAYNET' | 'SHOPTET' | 'POHODA' | 'PACKETA' | 'AIRTABLE'
  defaultMapping: Record<string, string>
  icon: string
  popular?: boolean
  proOnly?: boolean
}

export const SYNC_TEMPLATES: SyncTemplate[] = [
  {
    id: 'shoptet-raynet-orders',
    name: 'Shoptet → RAYNET: Objednávky',
    description: 'Importuj nové objednávky ze Shoptetu do RAYNET jako obchodní případy. IČO zákazníka se automaticky spáruje s firmou v CRM.',
    source: 'SHOPTET',
    target: 'RAYNET',
    popular: true,
    icon: '🛒',
    defaultMapping: {
      'billing.company':   'company.name',
      'billing.ico':       'company.regNumber',
      'billing.dic':       'company.taxNumber',
      'billing.email':     'company.email',
      'code':              'businessCase.name',
      'totalPriceWithVat': 'businessCase.totalAmount',
      'variableSymbol':    'businessCase.customFields.variabilniSymbol',
      'billing.street':    'company.address.street',
      'billing.city':      'company.address.city',
      'billing.zip':       'company.address.zip',
    },
  },
  {
    id: 'pohoda-raynet-faktury',
    name: 'Pohoda → RAYNET: Faktury',
    description: 'Synchronizuj vystavené faktury z Pohody do RAYNET CRM. Zákazníci se párují podle IČO. Variabilní symbol se uloží jako vlastní pole.',
    source: 'POHODA',
    target: 'RAYNET',
    icon: '📄',
    defaultMapping: {
      'variabilniSymbol': 'customFields.variabilniSymbol',
      'company':          'company.name',
      'ico':              'company.regNumber',
      'dic':              'company.taxNumber',
      'amount':           'totalAmount',
      'date':             'createdDate',
      'dateDue':          'dueDate',
      'currency':         'currency',
    },
  },
  {
    id: 'packeta-shoptet-tracking',
    name: 'Packeta → Shoptet: Tracking stavů',
    description: 'Automaticky aktualizuj stav objednávek v Shoptetu podle sledování zásilek Packety. Zákazníci dostanou notifikaci při doručení.',
    source: 'PACKETA',
    target: 'SHOPTET',
    icon: '📦',
    defaultMapping: {
      'id':     'trackingNumber',
      'status': 'orderStatus',
    },
  },
  {
    id: 'shoptet-airtable-orders',
    name: 'Shoptet → Airtable: Objednávky & projekty',
    description: 'Každá nová objednávka ze Shoptetu se uloží do Airtable jako záznam s termínem, stavem a odpovědnou osobou. Ideální pro projektové řízení e-shopu.',
    source: 'SHOPTET',
    target: 'AIRTABLE',
    proOnly: true,
    popular: true,
    icon: '📋',
    defaultMapping: {
      'code':              'Číslo objednávky',
      'billing.company':   'Firma',
      'billing.ico':       'IČO',
      'totalPriceWithVat': 'Celková cena',
      'status':            'Stav',
      'creationTime':      'Datum objednávky',
      'billing.email':     'Email',
    },
  },
  {
    id: 'raynet-airtable-contacts',
    name: 'RAYNET → Airtable: CRM kontakty',
    description: 'Synchronizuje kontakty a firmy z RAYNET CRM do Airtable. Udržujte přehled o klientech s historií hovorů, poznámkami a fotografiemi.',
    source: 'RAYNET',
    target: 'AIRTABLE',
    proOnly: true,
    icon: '👥',
    defaultMapping: {
      'name':       'Název firmy',
      'regNumber':  'IČO',
      'taxNumber':  'DIČ',
      'email':      'Email',
      'phone':      'Telefon',
      'category':   'Kategorie',
      'owner':      'Odpovědná osoba',
    },
  },
  {
    id: 'pohoda-airtable-invoices',
    name: 'Pohoda → Airtable: Fakturační přehled',
    description: 'Exportuje faktury z Pohody do Airtable pro přehledný pohled na pohledávky. Sledujte splatnosti, DPH a platební stav na jednom místě.',
    source: 'POHODA',
    target: 'AIRTABLE',
    proOnly: true,
    icon: '💰',
    defaultMapping: {
      'symVar':                    'Variabilní symbol',
      'company':                   'Firma',
      'ico':                       'IČO',
      'dic':                       'DIČ',
      'homeCurrency.priceHighSummary': 'Celkem s DPH',
      'date':                      'Datum vystavení',
      'dateDue':                   'Datum splatnosti',
    },
  },
  {
    id: 'packeta-airtable-shipments',
    name: 'Packeta → Airtable: Zásilky & logistika',
    description: 'Sledujte všechny zásilky Packety v Airtable. Automaticky aktualizuje stav doručení, eviduje reklamace a upozorní na nedoručené zásilky.',
    source: 'PACKETA',
    target: 'AIRTABLE',
    proOnly: true,
    icon: '🚚',
    defaultMapping: {
      'id':           'ID zásilky',
      'status':       'Stav zásilky',
      'trackingUrl':  'Tracking URL',
      'recipient':    'Příjemce',
      'weight':       'Váha (kg)',
      'cod':          'Dobírka (Kč)',
    },
  },
]

export function getTemplate(id: string): SyncTemplate | undefined {
  return SYNC_TEMPLATES.find(t => t.id === id)
}
