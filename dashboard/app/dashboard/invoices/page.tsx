'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCZK, formatCzechDate } from '@/lib/utils'
import type { Invoice } from '@/lib/supabase/types'

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'error' | 'warning' | 'info' | 'neutral' }> = {
  pending:      { label: 'Čeká',        variant: 'neutral' },
  processing:   { label: 'Zpracovává', variant: 'info' },
  extracted:    { label: 'Extrahováno', variant: 'info' },
  ares_checked: { label: 'ARES ✓',      variant: 'info' },
  crm_sent:     { label: 'Odesláno',    variant: 'success' },
  error:        { label: 'Chyba',       variant: 'error' },
  ignored:      { label: 'Ignorováno',  variant: 'neutral' },
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [reprocessing, setReprocessing] = useState<string | null>(null)
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
    setInvoices(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function syncNow() {
    setSyncing(true)
    await fetch('/api/process/invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    await load()
    setSyncing(false)
  }

  async function reprocess(id: string) {
    setReprocessing(id)
    await fetch('/api/process/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: id }),
    })
    await load()
    setReprocessing(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Faktury</h1>
          <p className="text-sm text-gray-500 mt-1">Přehled všech zpracovaných faktur</p>
        </div>
        <Button onClick={syncNow} loading={syncing} variant="secondary">
          🔄 Synchronizovat nyní
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            {!invoices.length ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                Žádné faktury. Připojte e-mail a klikněte na &quot;Synchronizovat nyní&quot;.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                    <th className="text-left px-4 py-3">Dodavatel</th>
                    <th className="text-left px-4 py-3">Č. faktury</th>
                    <th className="text-right px-4 py-3">Částka</th>
                    <th className="text-left px-4 py-3">Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const s = STATUS_BADGE[inv.status] ?? { label: inv.status, variant: 'neutral' as const }
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => setSelected(inv)}
                        className={`border-b border-gray-50 cursor-pointer hover:bg-blue-50 transition-colors ${selected?.id === inv.id ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[140px]">
                          <Link href={`/dashboard/invoices/${inv.id}`} className="hover:text-blue-600" onClick={e => e.stopPropagation()}>
                            {inv.supplier_name ?? '–'}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{inv.invoice_number ?? '–'}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCZK(inv.amount_total)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={s.variant}>{s.label}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Detail panel */}
        <div>
          {selected ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Detail faktury</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Field label="Dodavatel" value={selected.supplier_name} />
                <Field label="IČO" value={selected.supplier_ico} />
                <Field label="DIČ" value={selected.supplier_dic} />
                <Field label="Č. faktury" value={selected.invoice_number} />
                <Field label="Datum vystavení" value={formatCzechDate(selected.invoice_date)} />
                <Field label="DUZP" value={formatCzechDate(selected.duzp)} />
                <Field label="Splatnost" value={formatCzechDate(selected.due_date)} />
                <div className="border-t border-gray-100 pt-3">
                  <Field label="Základ DPH" value={formatCZK(selected.amount_without_vat)} />
                  <Field label="DPH" value={formatCZK(selected.vat_amount)} />
                  <Field label="Celkem" value={<strong>{formatCZK(selected.amount_total)}</strong>} />
                </div>
                <Field label="VS" value={selected.variable_symbol} />
                <Field label="Číslo účtu" value={selected.bank_account_cz} />
                {selected.ares_verified && (
                  <div className="rounded bg-green-50 border border-green-200 p-2 text-xs text-green-700">
                    ✓ Ověřeno v ARES: {selected.ares_company_name}
                  </div>
                )}
                {selected.status === 'error' && (
                  <div className="rounded bg-red-50 border border-red-200 p-2 text-xs text-red-700">
                    {selected.error_message}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full mt-2"
                  loading={reprocessing === selected.id}
                  onClick={() => reprocess(selected.id)}
                >
                  🔄 Znovu zpracovat
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-400 text-sm">
                Klikněte na fakturu pro detail
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right">{value ?? '–'}</span>
    </div>
  )
}
