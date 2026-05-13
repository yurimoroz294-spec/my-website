export interface SyncTemplate {
  id: string
  name: string
  description: string
  source: 'RAYNET' | 'SHOPTET' | 'POHODA' | 'PACKETA'
  target: 'RAYNET' | 'SHOPTET' | 'POHODA' | 'PACKETA'
  defaultMapping: Record<string, string>
  icon: string
  popular?: boolean
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
    id: 'email-pohoda-invoices',
    name: 'Email/PDF → Pohoda: Faktury (AI OCR)',
    description: 'AI (GPT-4o-mini) automaticky extrahuje data z PDF faktur přijatých emailem a vytvoří záznamy v Pohodě. Rozpozná IČO, DIČ, variabilní symbol a DPH.',
    source: 'RAYNET',
    target: 'POHODA',
    popular: true,
    icon: '🤖',
    defaultMapping: {
      'variabilniSymbol': 'symVar',
      'ico':              'ico',
      'dic':              'dic',
      'company':          'company',
      'amount':           'homeCurrency.priceNone',
      'amountWithVat':    'homeCurrency.priceHighSummary',
      'vatRate':          'vatRate',
      'date':             'date',
      'dateDue':          'dateDue',
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
]

export function getTemplate(id: string): SyncTemplate | undefined {
  return SYNC_TEMPLATES.find(t => t.id === id)
}
