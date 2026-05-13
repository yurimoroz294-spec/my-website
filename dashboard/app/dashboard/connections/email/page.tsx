'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { EmailConnection } from '@/lib/supabase/types'

export default function EmailConnectionsPage() {
  const [connections, setConnections] = useState<EmailConnection[]>([])
  const [showImap, setShowImap] = useState(false)
  const [imap, setImap] = useState({ host: '', port: '993', username: '', password: '', useSSL: true })
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('email_connections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setConnections(data ?? [])
  }

  useEffect(() => {
    load()
    // Show feedback from OAuth redirect
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'gmail') setMsg({ type: 'success', text: 'Gmail úspěšně připojen!' })
    if (params.get('error')) setMsg({ type: 'error', text: 'Připojení se nezdařilo. Zkuste to znovu.' })
  }, [])

  async function connectImap(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/email/connect/imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...imap, port: parseInt(imap.port) }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ type: 'error', text: data.error }); return }
      setMsg({ type: 'success', text: 'IMAP připojen!' })
      setShowImap(false)
      setImap({ host: '', port: '993', username: '', password: '', useSSL: true })
      await load()
    } finally {
      setLoading(false)
    }
  }

  async function testConnection(id: string) {
    setTesting(id)
    const res = await fetch(`/api/email/test/${id}`, { method: 'POST' })
    const data = await res.json()
    setMsg(res.ok
      ? { type: 'success', text: data.message }
      : { type: 'error', text: data.error })
    setTesting(null)
  }

  async function deleteConnection(id: string) {
    await supabase.from('email_connections').delete().eq('id', id)
    await load()
  }

  const providerLabel: Record<string, string> = {
    gmail: 'Gmail', imap: 'IMAP', seznam: 'Seznam.cz', outlook: 'Outlook',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Připojení e-mailu</h1>
        <p className="text-sm text-gray-500 mt-1">
          Připojte schránku, ze které přicházejí faktury. AI je automaticky zpracuje.
        </p>
      </div>

      {msg && (
        <div className={`rounded-lg p-3 text-sm ${msg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Connect buttons */}
      <Card>
        <CardHeader><CardTitle>Přidat e-mailovou schránku</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <a href="/api/email/connect/gmail">
              <Button variant="secondary" size="md">
                <span className="mr-2">📧</span> Připojit Gmail
              </Button>
            </a>
            <Button variant="secondary" onClick={() => setShowImap(v => !v)}>
              <span className="mr-2">🔌</span> Připojit IMAP (Seznam, Outlook…)
            </Button>
          </div>

          {showImap && (
            <form onSubmit={connectImap} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
              <div>
                <Label>IMAP server</Label>
                <Input
                  required placeholder="imap.seznam.cz"
                  value={imap.host}
                  onChange={e => setImap(v => ({ ...v, host: e.target.value }))}
                />
              </div>
              <div>
                <Label>Port</Label>
                <Input
                  required type="number"
                  value={imap.port}
                  onChange={e => setImap(v => ({ ...v, port: e.target.value }))}
                />
              </div>
              <div>
                <Label>E-mail / uživatel</Label>
                <Input
                  required type="email" placeholder="vas@firma.cz"
                  value={imap.username}
                  onChange={e => setImap(v => ({ ...v, username: e.target.value }))}
                />
              </div>
              <div>
                <Label>Heslo</Label>
                <Input
                  required type="password"
                  value={imap.password}
                  onChange={e => setImap(v => ({ ...v, password: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox" id="ssl" checked={imap.useSSL}
                  onChange={e => setImap(v => ({ ...v, useSSL: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="ssl" className="text-sm text-gray-700">Použít SSL/TLS</label>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" loading={loading}>Připojit</Button>
                <Button type="button" variant="ghost" onClick={() => setShowImap(false)}>Zrušit</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Existing connections */}
      {connections.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Připojené schránky</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                  <th className="text-left px-6 py-3">Schránka</th>
                  <th className="text-left px-6 py-3">Typ</th>
                  <th className="text-left px-6 py-3">Stav</th>
                  <th className="text-left px-6 py-3">Naposledy</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {connections.map(c => (
                  <tr key={c.id} className="border-b border-gray-50">
                    <td className="px-6 py-3 font-medium">{c.email_address}</td>
                    <td className="px-6 py-3 text-gray-500">{providerLabel[c.provider] ?? c.provider}</td>
                    <td className="px-6 py-3">
                      <Badge variant={c.is_verified ? 'success' : 'warning'}>
                        {c.is_verified ? 'Aktivní' : 'Neověřeno'}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-gray-400 text-xs">
                      {c.last_checked_at ? new Date(c.last_checked_at).toLocaleString('cs-CZ') : '–'}
                    </td>
                    <td className="px-6 py-3 flex gap-2 justify-end">
                      <Button
                        size="sm" variant="secondary"
                        loading={testing === c.id}
                        onClick={() => testConnection(c.id)}
                      >
                        Test
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => deleteConnection(c.id)}>
                        Odebrat
                      </Button>
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
