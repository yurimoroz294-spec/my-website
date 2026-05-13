'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { validateIco } from '@/lib/utils'
import type { Profile } from '@/lib/supabase/types'

const PLAN_COLORS: Record<string, 'neutral' | 'info' | 'success'> = {
  starter: 'neutral', pro: 'info', enterprise: 'success',
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState({ company_name: '', ico: '', dic: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('profiles') as any).select('*').eq('id', user.id).single()
    if (data) {
      const p = data as Profile
      setProfile(p)
      setForm({ company_name: p.company_name ?? '', ico: p.ico ?? '', dic: p.dic ?? '' })
    }
  }

  useEffect(() => { load() }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (form.ico && !validateIco(form.ico)) {
      setMsg({ type: 'error', text: 'IČO není platné (špatný kontrolní součet).' })
      return
    }
    if (form.dic && !/^CZ\d{8,10}$/.test(form.dic)) {
      setMsg({ type: 'error', text: 'DIČ musí být ve formátu CZxxxxxxxx.' })
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('profiles') as any)
      .update({ company_name: form.company_name, ico: form.ico || null, dic: form.dic || null })
      .eq('id', user!.id)
    setSaving(false)
    setMsg(error
      ? { type: 'error', text: (error as { message: string }).message }
      : { type: 'success', text: 'Uloženo.' })
  }

  const used = profile?.invoices_this_month ?? 0
  const limit = profile?.invoices_limit ?? 50
  const pct = Math.min(Math.round((used / limit) * 100), 100)

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nastavení</h1>
        <p className="text-sm text-gray-500 mt-1">Informace o vaší firmě</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Váš plán</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Aktuální plán</span>
            <Badge variant={PLAN_COLORS[profile?.plan ?? 'starter']}>
              {(profile?.plan ?? 'starter').toUpperCase()}
            </Badge>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Faktury tento měsíc</span>
              <span className="font-medium">{used} / {limit}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${pct > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          {pct > 80 && (
            <p className="text-xs text-red-600">
              Blížíte se limitu. Zvažte upgrade na Pro plán (500 faktur/měsíc).
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Údaje firmy</CardTitle></CardHeader>
        <CardContent>
          {msg && (
            <div className={`mb-4 rounded-lg p-3 text-sm ${msg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {msg.text}
            </div>
          )}
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label>Název firmy</Label>
              <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Vaše s.r.o." />
            </div>
            <div>
              <Label>IČO</Label>
              <Input value={form.ico} onChange={e => setForm(f => ({ ...f, ico: e.target.value.replace(/\D/g, '') }))} placeholder="12345678" maxLength={8} />
            </div>
            <div>
              <Label>DIČ</Label>
              <Input value={form.dic} onChange={e => setForm(f => ({ ...f, dic: e.target.value.toUpperCase() }))} placeholder="CZ12345678" />
            </div>
            <Button type="submit" loading={saving}>Uložit</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
