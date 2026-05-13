'use client'
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface LogEntry {
  id: string
  invoice_id: string | null
  action: string
  status: string
  message: string | null
  created_at: string
  invoices?: {
    invoice_number: string | null
    supplier_name: string | null
    attachment_filename: string | null
  } | null
}

const STATUS_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'info' | 'neutral'> = {
  success: 'success',
  error:   'error',
  warning: 'warning',
  info:    'info',
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

const FILTER_OPTIONS = [
  { label: 'Vše', value: '' },
  { label: 'Úspěch', value: 'success' },
  { label: 'Chyby', value: 'error' },
  { label: 'Varování', value: 'warning' },
  { label: 'Info', value: 'info' },
]

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '200' })
    if (filter) params.set('status', filter)
    const res = await fetch(`/api/logs?${params}`)
    const data = await res.json()
    setLogs(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const errorCount   = logs.filter(l => l.status === 'error').length
  const successCount = logs.filter(l => l.status === 'success').length
  const warnCount    = logs.filter(l => l.status === 'warning').length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logy zpracování</h1>
          <p className="text-sm text-gray-500 mt-1">
            Auditní stopa každé extrakce, ARES ověření a odeslání do CRM.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} loading={loading}>
          🔄 Obnovit
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xl font-bold text-green-600">{successCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Úspěšných operací</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xl font-bold text-red-600">{errorCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Chyb</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xl font-bold text-yellow-600">{warnCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Varování</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Záznamy ({logs.length})</CardTitle>
            {/* Filter tabs */}
            <div className="flex gap-1">
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filter === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Načítám…</div>
          ) : !logs.length ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              {filter ? `Žádné záznamy se statusem "${filter}".` : 'Zatím žádné logy.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {logs.map(log => {
                const inv = log.invoices
                const label = ACTION_LABELS[log.action] ?? log.action
                const variant = STATUS_VARIANT[log.status] ?? 'neutral'
                const time = new Date(log.created_at).toLocaleString('cs-CZ')

                return (
                  <div key={log.id} className="px-6 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      {/* Status dot */}
                      <div className="mt-1 shrink-0">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          log.status === 'success' ? 'bg-green-500' :
                          log.status === 'error'   ? 'bg-red-500' :
                          log.status === 'warning' ? 'bg-yellow-500' : 'bg-blue-400'
                        }`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{label}</span>
                          <Badge variant={variant}>{log.status}</Badge>
                          {inv && (
                            <span className="text-xs text-gray-400 truncate">
                              {inv.supplier_name ?? inv.invoice_number ?? inv.attachment_filename ?? '–'}
                            </span>
                          )}
                        </div>
                        {log.message && (
                          <p className="text-xs text-gray-600 mt-0.5 break-words">{log.message}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">{time}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
