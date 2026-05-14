'use client'

import { useState } from 'react'
import { Copy, Check, Mail, Send, Trash2, RotateCcw, Zap, Settings2 } from 'lucide-react'

type InvoiceStatus = 'PENDING' | 'PARSED' | 'SENT' | 'FAILED'
type TargetPlatform = 'POHODA' | 'RAYNET' | 'AIRTABLE' | 'MONEY_S3' | 'IDOKLAD' | 'FAKTUROID' | 'ABRA_FLEXI' | null

interface Invoice {
  id: string
  fromEmail: string
  subject: string | null
  fileName: string | null
  status: InvoiceStatus
  errorMessage: string | null
  variabilniSymbol: string | null
  company: string | null
  amount: number | null
  amountWithVat: number | null
  currency: string | null
  date: string | null
  dateDue: string | null
  sentAt: string | null
  createdAt: string
}

interface Props {
  inboxEmail: string
  initialInvoices: Invoice[]
  autoSend: boolean
  targetPlatform: TargetPlatform
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  PENDING: 'Čeká',
  PARSED: 'Přečtena',
  SENT: 'Odesláno',
  FAILED: 'Chyba',
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  PARSED: 'bg-blue-100 text-blue-700',
  SENT: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
}

const PLATFORM_OPTIONS: { value: TargetPlatform; label: string; desc: string }[] = [
  { value: null,         label: 'Nevybráno',         desc: 'Pouze ruční odesílání' },
  { value: 'POHODA',     label: 'Pohoda',            desc: 'Vytvoří vydanou fakturu v Pohoda mServeru' },
  { value: 'MONEY_S3',   label: 'Money S3',          desc: 'Vytvoří fakturu v Money S3 přes mServer XML' },
  { value: 'IDOKLAD',    label: 'iDoklad',           desc: 'Vytvoří vydanou fakturu v cloudu iDoklad' },
  { value: 'FAKTUROID',  label: 'Fakturoid',         desc: 'Vytvoří fakturu a subjekt v Fakturoidu' },
  { value: 'ABRA_FLEXI', label: 'ABRA Flexi',        desc: 'Vytvoří fakturu-vydanou v ABRA Flexi' },
  { value: 'RAYNET',     label: 'RAYNET CRM',        desc: 'Vytvoří fakturu a spáruje firmu podle IČO' },
  { value: 'AIRTABLE',   label: 'Airtable',          desc: 'Přidá řádek do tabulky "Faktury" ve vašem Base' },
]

function fmt(n: number | null, currency: string | null) {
  if (n == null) return '–'
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: currency ?? 'CZK' }).format(n)
}

export function InvoicesClient({ inboxEmail, initialInvoices, autoSend: initAutoSend, targetPlatform: initTarget }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [autoSend, setAutoSend] = useState(initAutoSend)
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>(initTarget)
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function copyEmail() {
    await navigator.clipboard.writeText(inboxEmail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveSetting(
    patch: { autoSendInvoices?: boolean; invoiceTargetPlatform?: TargetPlatform },
    rollback: () => void,
  ) {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        rollback()
        setSaveError('Nepodařilo se uložit nastavení. Zkuste to znovu.')
      }
    } catch {
      rollback()
      setSaveError('Chyba sítě. Zkontrolujte připojení a zkuste to znovu.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAutoSendToggle() {
    const prev = autoSend
    const next = !prev
    setAutoSend(next)
    await saveSetting({ autoSendInvoices: next }, () => setAutoSend(prev))
  }

  async function handleTargetChange(value: TargetPlatform) {
    const prev = targetPlatform
    setTargetPlatform(value)
    await saveSetting({ invoiceTargetPlatform: value }, () => setTargetPlatform(prev))
  }

  async function handleSend(id: string) {
    setSending(id)
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: 'POST' })
      const data = await res.json()
      if (data.invoice) {
        setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...data.invoice } : inv))
      }
      if (!res.ok) alert(data.error ?? 'Chyba při odesílání')
    } finally {
      setSending(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Opravdu smazat tuto fakturu?')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
      if (res.ok) setInvoices(prev => prev.filter(inv => inv.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const selectedOption = PLATFORM_OPTIONS.find(o => o.value === targetPlatform) ?? PLATFORM_OPTIONS[0]
  const canAutoSend = targetPlatform !== null

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Inbox faktur</h1>
        <p className="text-sm text-gray-500 mt-1">
          Přeposílej faktury PDF na svou inbox adresu — AI je přečte a odešle do zvoleného systému.
        </p>
      </div>

      {/* Inbox email card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">Vaše inbox adresa</span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <code className="flex-1 bg-white border border-blue-200 rounded-lg px-4 py-2.5 text-sm font-mono text-gray-800 select-all truncate">
            {inboxEmail}
          </code>
          <button
            onClick={copyEmail}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Zkopírováno' : 'Kopírovat'}
          </button>
        </div>
        <p className="text-xs text-blue-700 mt-2">
          Přeposílej nebo posílej faktury s PDF přílohou na tuto adresu. Každá doručená faktura se zobrazí níže.
        </p>
      </div>

      {/* Settings row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Target platform selector */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Settings2 className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-900">Cílový systém</span>
          </div>
          <div className="space-y-2">
            {PLATFORM_OPTIONS.map(opt => (
              <label
                key={String(opt.value)}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  targetPlatform === opt.value
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="targetPlatform"
                  checked={targetPlatform === opt.value}
                  onChange={() => handleTargetChange(opt.value)}
                  className="mt-0.5 text-blue-600"
                  disabled={saving}
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Auto-send toggle */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-gray-900">Automatické odesílání</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Po každém úspěšném parsování okamžitě odešle fakturu do zvoleného systému bez nutnosti ruční akce.
          </p>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${canAutoSend ? 'text-gray-700' : 'text-gray-400'}`}>
              {canAutoSend
                ? (autoSend ? `Zapnuto → ${selectedOption.label}` : 'Vypnuto')
                : 'Nejdříve vyberte cílový systém'}
            </span>
            <button
              onClick={handleAutoSendToggle}
              disabled={saving || !canAutoSend}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                autoSend && canAutoSend ? 'bg-blue-600' : 'bg-gray-200'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoSend && canAutoSend ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {saveError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Mail className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Zatím žádné faktury. Přeposli PDF na svou inbox adresu výše.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => (
            <div key={inv.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                      {STATUS_LABELS[inv.status]}
                    </span>
                    {inv.fileName && (
                      <span className="text-xs text-gray-400 truncate">{inv.fileName}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 mt-2">
                    {inv.company && (
                      <div>
                        <p className="text-xs text-gray-400">Firma</p>
                        <p className="text-sm font-medium truncate">{inv.company}</p>
                      </div>
                    )}
                    {inv.variabilniSymbol && (
                      <div>
                        <p className="text-xs text-gray-400">Var. symbol</p>
                        <p className="text-sm font-medium">{inv.variabilniSymbol}</p>
                      </div>
                    )}
                    {inv.amountWithVat != null && (
                      <div>
                        <p className="text-xs text-gray-400">Celkem s DPH</p>
                        <p className="text-sm font-medium">{fmt(inv.amountWithVat, inv.currency)}</p>
                      </div>
                    )}
                    {inv.dateDue && (
                      <div>
                        <p className="text-xs text-gray-400">Splatnost</p>
                        <p className="text-sm font-medium">{inv.dateDue}</p>
                      </div>
                    )}
                  </div>

                  {inv.status === 'FAILED' && inv.errorMessage && (
                    <p className="text-xs text-red-600 mt-2">{inv.errorMessage}</p>
                  )}

                  <p className="text-xs text-gray-400 mt-2">
                    Od: {inv.fromEmail} · {new Date(inv.createdAt).toLocaleString('cs-CZ')}
                    {inv.sentAt && ` · Odesláno: ${new Date(inv.sentAt).toLocaleString('cs-CZ')}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {(inv.status === 'PARSED' || inv.status === 'FAILED') && (
                    <button
                      onClick={() => handleSend(inv.id)}
                      disabled={sending === inv.id || !targetPlatform}
                      title={!targetPlatform ? 'Nejdříve vyberte cílový systém' : `Odeslat do ${selectedOption.label}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {sending === inv.id ? (
                        <RotateCcw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      {selectedOption.label}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(inv.id)}
                    disabled={deleting === inv.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
