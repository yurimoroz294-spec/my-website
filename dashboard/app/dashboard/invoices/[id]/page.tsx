import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCZK, formatCzechDate, getBankName } from '@/lib/utils'
import type { Invoice, ProcessingLog } from '@/lib/supabase/types'
import { InvoiceActions } from './invoice-actions'

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'error' | 'warning' | 'info' | 'neutral' }> = {
  pending:      { label: 'Čeká',        variant: 'neutral' },
  processing:   { label: 'Zpracovává', variant: 'info' },
  extracted:    { label: 'Extrahováno', variant: 'info' },
  ares_checked: { label: 'ARES ✓',      variant: 'info' },
  crm_sent:     { label: 'Odesláno',    variant: 'success' },
  error:        { label: 'Chyba',       variant: 'error' },
  ignored:      { label: 'Ignorováno',  variant: 'neutral' },
}

const ACTION_LABELS: Record<string, string> = {
  extraction_started: 'Zahájení extrakce',
  extraction_done:    'Extrakce dokončena',
  ares_lookup:        'ARES dotaz',
  ares_verified:      'ARES ověřen',
  crm_success:        'Odesláno do CRM',
  error:              'Chyba',
  email_received:     'E-mail přijat',
  retry:              'Opakování',
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: invData }, { data: logsData }] = await Promise.all([
    (supabase.from('invoices') as any).select('*').eq('id', id).eq('user_id', user!.id).single(),
    (supabase.from('processing_logs') as any)
      .select('*')
      .eq('invoice_id', id)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true }),
  ])

  if (!invData) notFound()

  const inv = invData as Invoice
  const logs = (logsData ?? []) as ProcessingLog[]
  const s = STATUS_BADGE[inv.status] ?? { label: inv.status, variant: 'neutral' as const }
  const dphLines = (inv.dph_lines as { rate: number; base: number; vat_amount: number }[] | null) ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/dashboard/invoices" className="hover:text-blue-600">← Faktury</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {inv.supplier_name ?? 'Neznámý dodavatel'}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-gray-500">{inv.invoice_number ?? '–'}</span>
            <Badge variant={s.variant}>{s.label}</Badge>
            {inv.ares_verified && (
              <Badge variant="success">ARES ✓</Badge>
            )}
          </div>
        </div>
        <InvoiceActions invoiceId={inv.id} invoiceNumber={inv.invoice_number} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Invoice fields */}
        <div className="lg:col-span-2 space-y-4">
          {/* Dates */}
          <Card>
            <CardHeader><CardTitle>Datumy</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 text-sm">
              <Field label="Datum vystavení" value={formatCzechDate(inv.invoice_date)} />
              <Field label="DUZP" value={formatCzechDate(inv.duzp)} highlight />
              <Field label="Datum splatnosti" value={formatCzechDate(inv.due_date)} />
            </CardContent>
          </Card>

          {/* Supplier */}
          <Card>
            <CardHeader><CardTitle>Dodavatel</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Název" value={inv.supplier_name} span2 />
              <Field label="IČO" value={inv.supplier_ico} mono />
              <Field label="DIČ" value={inv.supplier_dic} mono />
              <Field label="Adresa" value={[inv.supplier_address, inv.supplier_city, inv.supplier_zip].filter(Boolean).join(', ')} span2 />
              {inv.ares_verified && (
                <div className="col-span-2 rounded-lg bg-green-50 border border-green-200 p-3">
                  <p className="text-xs font-medium text-green-700">✓ Ověřeno v ARES</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    {inv.ares_company_name} · DIČ: {inv.ares_dic ?? 'není plátce DPH'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Amounts */}
          <Card>
            <CardHeader><CardTitle>Částky ({inv.currency})</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-3">
              {dphLines.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                      <th className="text-left pb-2">Sazba DPH</th>
                      <th className="text-right pb-2">Základ</th>
                      <th className="text-right pb-2">DPH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dphLines.map((l, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-1.5 text-gray-700">{l.rate}%</td>
                        <td className="py-1.5 text-right">{formatCZK(l.base)}</td>
                        <td className="py-1.5 text-right">{formatCZK(l.vat_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="pt-2">Celkem</td>
                      <td className="pt-2 text-right">{formatCZK(inv.amount_without_vat)}</td>
                      <td className="pt-2 text-right">{formatCZK(inv.vat_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Základ DPH" value={formatCZK(inv.amount_without_vat)} />
                  <Field label="DPH" value={formatCZK(inv.vat_amount)} />
                  <Field label="Celkem" value={formatCZK(inv.amount_total)} bold />
                </div>
              )}
              <div className="pt-2 border-t border-gray-100 text-right">
                <span className="text-lg font-bold text-gray-900">{formatCZK(inv.amount_total)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader><CardTitle>Platební údaje</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Variabilní symbol" value={inv.variable_symbol} mono highlight />
              <Field label="Konstantní symbol" value={inv.constant_symbol} mono />
              <div>
                <span className="text-xs text-gray-500 block mb-0.5">Číslo účtu</span>
                <span className="font-mono text-gray-900">{inv.bank_account_cz ?? '–'}</span>
                {inv.bank_account_cz && (
                  <span className="ml-2 text-xs text-gray-400">{getBankName(inv.bank_account_cz)}</span>
                )}
              </div>
              <Field label="IBAN" value={inv.iban} mono />
              {inv.swift && <Field label="SWIFT/BIC" value={inv.swift} mono />}
              {inv.payment_method && <Field label="Způsob platby" value={inv.payment_method} />}
            </CardContent>
          </Card>

          {/* Error */}
          {inv.status === 'error' && inv.error_message && (
            <Card>
              <CardContent className="pt-4">
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-xs font-medium text-red-700 mb-1">Chyba zpracování</p>
                  <p className="text-xs text-red-600 font-mono whitespace-pre-wrap">{inv.error_message}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Processing timeline */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Průběh zpracování</CardTitle></CardHeader>
            <CardContent>
              {!logs.length ? (
                <p className="text-sm text-gray-400">Žádné záznamy.</p>
              ) : (
                <ol className="relative border-l border-gray-200 space-y-4 ml-2">
                  {logs.map(log => (
                    <li key={log.id} className="ml-4">
                      <span className={`absolute -left-1.5 mt-1 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-white ${
                        log.status === 'success' ? 'bg-green-500' :
                        log.status === 'error'   ? 'bg-red-500' :
                        log.status === 'warning' ? 'bg-yellow-400' : 'bg-blue-400'
                      }`} />
                      <p className="text-xs font-medium text-gray-800">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </p>
                      {log.message && (
                        <p className="text-xs text-gray-500 mt-0.5 break-words">{log.message}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(log.created_at).toLocaleTimeString('cs-CZ')}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Source info */}
          <Card>
            <CardHeader><CardTitle>Zdroj</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <Field label="Soubor" value={inv.attachment_filename} />
              <Field label="Typ" value={inv.attachment_type?.toUpperCase()} />
              <Field label="Od" value={inv.email_from} />
              <Field label="Předmět" value={inv.email_subject} />
              <Field label="Přijato" value={inv.email_received_at ? new Date(inv.email_received_at).toLocaleString('cs-CZ') : null} />
              {inv.crm_record_id && (
                <Field label="CRM ID" value={inv.crm_record_id} mono />
              )}
              {inv.extraction_model && (
                <Field label="AI model" value={`${inv.extraction_model} (${inv.extraction_tokens ?? 0} tokenů)`} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, value, mono, bold, highlight, span2,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  bold?: boolean
  highlight?: boolean
  span2?: boolean
}) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <span className="text-xs text-gray-500 block mb-0.5">{label}</span>
      <span className={`text-gray-900 ${mono ? 'font-mono' : ''} ${bold ? 'font-semibold' : ''} ${highlight ? 'text-blue-700 font-medium' : ''}`}>
        {value ?? '–'}
      </span>
    </div>
  )
}
