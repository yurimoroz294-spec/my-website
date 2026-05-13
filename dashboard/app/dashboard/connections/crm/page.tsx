'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CrmConnection, CrmType } from '@/lib/supabase/types'

const CRM_OPTIONS: { value: CrmType; label: string; desc: string }[] = [
  { value: 'pohoda',     label: 'Pohoda',      desc: 'Stormware Pohoda (XML import nebo mServer)' },
  { value: 'fakturoid',  label: 'Fakturoid',   desc: 'Cloudové účetnictví Fakturoid' },
  { value: 'idoklad',    label: 'iDoklad',     desc: 'iDoklad online fakturace' },
  { value: 'money_s3',   label: 'Money S3/S5', desc: 'Cegem Money (XML/CSV export)' },
  { value: 'raynet',     label: 'RAYNET CRM',  desc: 'RAYNET CRM systém' },
]

const CRM_ICONS: Record<string, string> = {
  pohoda: '🏦', fakturoid: '🧾', idoklad: '📋', money_s3: '💰', raynet: '🔗',
}

export default function CrmConnectionsPage() {
  const [connections, setConnections] = useState<CrmConnection[]>([])
  const [showForm, setShowForm] = useState(false)
  const [crmType, setCrmType] = useState<CrmType>('fakturoid')
  const [fields, setFields] = useState({
    display_name: '', api_key: '', api_url: '', api_secret: '',
    fakturoid_slug: '', fakturoid_user_email: '', idoklad_client_id: '',
    pohoda_version: 'xml', pohoda_ico: '',
  })
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const supabase = createClient()
  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFields(f => ({ ...f, [k]: e.target.value }))

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('crm_connections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setConnections(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function connect(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/crm/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crm_type: crmType, ...fields }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ type: 'error', text: data.error }); return }
      setMsg({ type: 'success', text: 'Účetní systém úspěšně připojen!' })
      setShowForm(false)
      await load()
    } finally {
      setLoading(false)
    }
  }

  async function testConn(id: string) {
    setTesting(id)
    const res = await fetch(`/api/crm/test/${id}`, { method: 'POST' })
    const data = await res.json()
    setMsg(res.ok ? { type: 'success', text: data.message } : { type: 'error', text: data.error })
    setTesting(null)
  }

  async function deleteConn(id: string) {
    await supabase.from('crm_connections').delete().eq('id', id)
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Účetní systém</h1>
        <p className="text-sm text-gray-500 mt-1">
          Připojte Pohodu, Fakturoid nebo jiný systém. Extrahované faktury tam budeme odesílat automaticky.
        </p>
      </div>

      {msg && (
        <div className={`rounded-lg p-3 text-sm ${msg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Připojit účetní systém</CardTitle>
            {!showForm && (
              <Button onClick={() => setShowForm(true)}>+ Přidat</Button>
            )}
          </div>
        </CardHeader>

        {showForm && (
          <CardContent>
            <form onSubmit={connect} className="space-y-4">
              <div>
                <Label>Systém</Label>
                <Select value={crmType} onChange={e => setCrmType(e.target.value as CrmType)}>
                  {CRM_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>Název připojení</Label>
                <Input required placeholder="např. Firma XY – Pohoda" value={fields.display_name} onChange={set('display_name')} />
              </div>

              {/* Fakturoid */}
              {crmType === 'fakturoid' && (
                <>
                  <div><Label>Slug účtu (z URL)</Label><Input required placeholder="firma-xy" value={fields.fakturoid_slug} onChange={set('fakturoid_slug')} /></div>
                  <div><Label>Váš e-mail (Fakturoid login)</Label><Input required type="email" value={fields.fakturoid_user_email} onChange={set('fakturoid_user_email')} /></div>
                  <div><Label>API klíč</Label><Input required type="password" placeholder="••••••••" value={fields.api_key} onChange={set('api_key')} /></div>
                </>
              )}

              {/* iDoklad */}
              {crmType === 'idoklad' && (
                <>
                  <div><Label>Client ID</Label><Input required value={fields.idoklad_client_id} onChange={set('idoklad_client_id')} /></div>
                  <div><Label>Client Secret</Label><Input required type="password" value={fields.api_secret} onChange={set('api_secret')} /></div>
                </>
              )}

              {/* Pohoda */}
              {crmType === 'pohoda' && (
                <>
                  <div>
                    <Label>Způsob integrace</Label>
                    <Select value={fields.pohoda_version} onChange={set('pohoda_version')}>
                      <option value="xml">XML import (stáhnout soubor)</option>
                      <option value="mserver">mServer REST API</option>
                    </Select>
                  </div>
                  <div><Label>IČO vaší firmy v Pohodě</Label><Input required placeholder="12345678" value={fields.pohoda_ico} onChange={set('pohoda_ico')} /></div>
                  {fields.pohoda_version === 'mserver' && (
                    <>
                      <div><Label>mServer URL</Label><Input required placeholder="http://192.168.1.10:8765" value={fields.api_url} onChange={set('api_url')} /></div>
                      <div><Label>API heslo</Label><Input required type="password" value={fields.api_key} onChange={set('api_key')} /></div>
                    </>
                  )}
                </>
              )}

              {/* RAYNET */}
              {crmType === 'raynet' && (
                <>
                  <div><Label>API URL</Label><Input required placeholder="https://app.raynet.cz/api/v2" value={fields.api_url} onChange={set('api_url')} /></div>
                  <div><Label>API klíč</Label><Input required type="password" value={fields.api_key} onChange={set('api_key')} /></div>
                </>
              )}

              {/* Money S3 */}
              {crmType === 'money_s3' && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
                  Money S3/S5 podporuje import přes XML soubor. Po zpracování faktury si stáhnete XML, který importujete do Money.
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={loading}>Připojit a ověřit</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Zrušit</Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {connections.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Připojené systémy</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                  <th className="text-left px-6 py-3">Systém</th>
                  <th className="text-left px-6 py-3">Název</th>
                  <th className="text-left px-6 py-3">Stav</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {connections.map(c => (
                  <tr key={c.id} className="border-b border-gray-50">
                    <td className="px-6 py-3 font-medium">
                      {CRM_ICONS[c.crm_type]} {CRM_OPTIONS.find(o => o.value === c.crm_type)?.label ?? c.crm_type}
                    </td>
                    <td className="px-6 py-3 text-gray-500">{c.display_name ?? '–'}</td>
                    <td className="px-6 py-3">
                      <Badge variant={c.is_verified ? 'success' : 'warning'}>
                        {c.is_verified ? 'Ověřeno' : 'Neověřeno'}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 flex gap-2 justify-end">
                      <Button size="sm" variant="secondary" loading={testing === c.id} onClick={() => testConn(c.id)}>Test</Button>
                      <Button size="sm" variant="danger" onClick={() => deleteConn(c.id)}>Odebrat</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
