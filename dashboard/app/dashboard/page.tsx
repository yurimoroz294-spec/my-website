import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCZK, formatCzechDate } from '@/lib/utils'
import type { Profile, Invoice, InvoiceStatus } from '@/lib/supabase/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, invoicesRes, totalRes, successRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('invoices').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).eq('status', 'crm_sent'),
  ])

  const profile = profileRes.data as Profile | null
  const invoices = (invoicesRes.data ?? []) as Invoice[]
  const total = totalRes.count ?? 0
  const successCount = successRes.count ?? 0

  const stats = [
    { label: 'Celkem faktur', value: total, icon: '🧾' },
    { label: 'Odesláno do CRM', value: successCount, icon: '✅' },
    {
      label: 'Zpracováno tento měsíc',
      value: profile?.invoices_this_month ?? 0,
      icon: '📅',
      sub: `z ${profile?.invoices_limit ?? 50} (${profile?.plan ?? 'starter'})`,
    },
    {
      label: 'Úspěšnost',
      value: total ? `${Math.round((successCount / total) * 100)}%` : '–',
      icon: '🎯',
    },
  ]

  const statusBadge: Record<string, { label: string; variant: 'success' | 'error' | 'warning' | 'info' | 'neutral' }> = {
    pending:      { label: 'Čeká',        variant: 'neutral' },
    processing:   { label: 'Zpracovává', variant: 'info' },
    extracted:    { label: 'Extrahováno', variant: 'info' },
    ares_checked: { label: 'ARES ✓',      variant: 'info' },
    crm_sent:     { label: 'Odesláno',    variant: 'success' },
    error:        { label: 'Chyba',       variant: 'error' },
    ignored:      { label: 'Ignorováno',  variant: 'neutral' },
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Přehled</h1>
        <p className="text-sm text-gray-500 mt-1">Vítejte zpět, {profile?.company_name ?? user!.email}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="pt-5">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              {s.sub && <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Poslední faktury</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!invoices.length ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Zatím žádné faktury. Připojte e-mail a začněte automatizovat.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-6 py-3">Dodavatel</th>
                  <th className="text-left px-6 py-3">Č. faktury</th>
                  <th className="text-left px-6 py-3">DUZP</th>
                  <th className="text-right px-6 py-3">Částka</th>
                  <th className="text-left px-6 py-3">Stav</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const s = statusBadge[inv.status as InvoiceStatus] ?? { label: inv.status, variant: 'neutral' as const }
                  return (
                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{inv.supplier_name ?? '–'}</td>
                      <td className="px-6 py-3 text-gray-600">{inv.invoice_number ?? '–'}</td>
                      <td className="px-6 py-3 text-gray-600">{formatCzechDate(inv.duzp)}</td>
                      <td className="px-6 py-3 text-right font-medium">{formatCZK(inv.amount_total)}</td>
                      <td className="px-6 py-3"><Badge variant={s.variant}>{s.label}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
