'use client'

import { useState } from 'react'
import { Copy, Check, Mail, Send, Trash2, RotateCcw, Zap } from 'lucide-react'

type InvoiceStatus = 'PENDING' | 'PARSED' | 'SENT' | 'FAILED'

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

function fmt(n: number | null, currency: string | null) {
  if (n == null) return '–'
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: currency ?? 'CZK' }).format(n)
}

export function InvoicesClient({ inboxEmail, initialInvoices, autoSend: initialAutoSend }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [autoSend, setAutoSend] = useState(initialAutoSend)
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)

  async function copyEmail() {
    await navigator.clipboard.writeText(inboxEmail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleAutoSendToggle() {
    setToggling(true)
    const next = !autoSend
    try {
      const res = await fetch('/api/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSendInvoices: next }),
      })
      if (res.ok) setAutoSend(next)
    } finally {
      setToggling(false)
    }
  }

  async function handleSend(id: string) {
    setSending(id)
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setInvoices(prev =>
          prev.map(inv => (inv.id === id ? { ...inv, ...data.invoice } : inv))
        )
      } else {
        alert(data.error ?? 'Chyba při odesílání')
      }
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

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Inbox faktur</h1>
        <p className="text-sm text-gray-500 mt-1">
          Přeposílej faktury PDF na svou inbox adresu — AI je přečte a volitelně odešle do Pohody.
        </p>
      </div>

      {/* Inbox email card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">Vaše inbox adresa</span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <code className="flex-1 bg-white border border-blue-200 rounded-lg px-4 py-2.5 text-sm font-mono text-gray-800 select-all">
            {inboxEmail}
          </code>
          <button
            onClick={copyEmail}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Zkopírováno' : 'Kopírovat'}
          </button>
        </div>
        <p className="text-xs text-blue-700 mt-2">
          Přeposílej nebo posílej faktury s PDF přílohou na tuto adresu. Každá doručená faktura se zobrazí níže.
        </p>
      </div>

      {/* Auto-send toggle */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Zap className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Automatické odesílání do Pohody</p>
            <p className="text-xs text-gray-500">Po každém úspěšném parsování okamžitě vytvoří fakturu v Pohoda mServeru.</p>
          </div>
        </div>
        <button
          onClick={handleAutoSendToggle}
          disabled={toggling}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            autoSend ? 'bg-blue-600' : 'bg-gray-200'
          } ${toggling ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              autoSend ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

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
                      disabled={sending === inv.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {sending === inv.id ? (
                        <RotateCcw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      Pohoda
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
