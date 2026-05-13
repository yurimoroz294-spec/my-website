'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ChevronRight, Wand2 } from 'lucide-react'
import type { Platform, Plan } from '@prisma/client'
import type { SyncTemplate } from '@/lib/sync/templates'

interface Connection { id: string; platform: Platform; name: string }

interface Props {
  connections: Connection[]
  template: SyncTemplate | null
  userPlan: Plan
}

const SCHEDULE_OPTIONS = [
  { value: 'MANUAL',     label: 'Manuálně' },
  { value: 'EVERY_5MIN', label: 'Každých 5 minut', pro: true },
  { value: 'EVERY_HOUR', label: 'Každou hodinu' },
  { value: 'DAILY',      label: 'Denně' },
  { value: 'WEEKLY',     label: 'Týdně' },
]

export function SyncWizard({ connections, template, userPlan }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [sourceId, setSourceId] = useState(
    template ? connections.find(c => c.platform === template.source)?.id ?? '' : ''
  )
  const [targetId, setTargetId] = useState(
    template ? connections.find(c => c.platform === template.target)?.id ?? '' : ''
  )
  const [name, setName] = useState(template?.name ?? '')
  const [schedule, setSchedule] = useState('DAILY')
  const [mapping, setMapping] = useState<Record<string, string>>(template?.defaultMapping ?? {})
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function suggestMapping() {
    if (!sourceId || !targetId) return
    setAiLoading(true)
    const src = connections.find(c => c.id === sourceId)
    const tgt = connections.find(c => c.id === targetId)
    try {
      const res = await fetch('/api/ai/map-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePlatform: src?.platform, targetPlatform: tgt?.platform }),
      })
      const data = await res.json()
      if (data.mapping) {
        const newMapping: Record<string, string> = {}
        for (const m of data.mapping) newMapping[m.sourceField] = m.targetField
        setMapping(prev => ({ ...newMapping, ...prev }))
      }
    } finally {
      setAiLoading(false)
    }
  }

  async function handleCreate() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/syncs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sourceConnectionId: sourceId,
          targetConnectionId: targetId,
          templateId: template?.id,
          fieldMapping: mapping,
          schedule,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Chyba při vytváření')
      }
      router.push('/app/sync')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neznámá chyba')
      setSaving(false)
    }
  }

  const sourceConn = connections.find(c => c.id === sourceId)
  const targetConn = connections.find(c => c.id === targetId)

  return (
    <div className="max-w-2xl">
      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step === s ? 'bg-blue-700 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'
            }`}>{s}</div>
            <span className={`text-sm ${step === s ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
              {['Zdroj & cíl', 'Mapování polí', 'Plán & uložení'][i]}
            </span>
            {i < 2 && <ChevronRight className="h-4 w-4 text-gray-300" />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Název synchronizace</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="např. Shoptet → RAYNET objednávky"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Zdroj dat</label>
              {connections.length === 0 ? (
                <div className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg">
                  Nejdříve připojte platformy v sekci <a href="/app/connections" className="underline font-medium">Propojení</a>.
                </div>
              ) : (
                <select value={sourceId} onChange={e => setSourceId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                  <option value="">-- Vyberte zdroj --</option>
                  {connections.map(c => (
                    <option key={c.id} value={c.id}>{c.platform} — {c.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cíl synchronizace</label>
              <select value={targetId} onChange={e => setTargetId(e.target.value)}
                disabled={!sourceId}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white disabled:opacity-50">
                <option value="">-- Vyberte cíl --</option>
                {connections.filter(c => c.id !== sourceId).map(c => (
                  <option key={c.id} value={c.id}>{c.platform} — {c.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!sourceId || !targetId || !name}
              className="w-full bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-800 disabled:opacity-40 transition-colors"
            >
              Pokračovat →
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Mapování polí</h3>
              <button onClick={suggestMapping} disabled={aiLoading}
                className="flex items-center gap-1.5 text-sm text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50">
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                AI návrh
              </button>
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
              {sourceConn?.platform} → {targetConn?.platform}
              {template && ' · Šablona: ' + template.name}
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {Object.entries(mapping).map(([src, tgt]) => (
                <div key={src} className="flex items-center gap-2">
                  <input value={src} readOnly className="flex-1 text-xs px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 font-mono" />
                  <span className="text-gray-400 text-xs">→</span>
                  <input value={tgt}
                    onChange={e => setMapping(m => ({ ...m, [src]: e.target.value }))}
                    className="flex-1 text-xs px-2.5 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono" />
                  <button onClick={() => setMapping(m => { const n = { ...m }; delete n[src]; return n })}
                    className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                ← Zpět
              </button>
              <button onClick={() => setStep(3)} className="flex-1 bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors">
                Pokračovat →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Plán spouštění</label>
              <div className="space-y-2">
                {SCHEDULE_OPTIONS.map(opt => {
                  const disabled = opt.pro && userPlan === 'FREE'
                  return (
                    <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      schedule === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                      <input type="radio" name="schedule" value={opt.value} checked={schedule === opt.value}
                        disabled={disabled} onChange={() => !disabled && setSchedule(opt.value)}
                        className="text-blue-700" />
                      <span className="text-sm text-gray-700">{opt.label}</span>
                      {disabled && <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Pro</span>}
                    </label>
                  )
                })}
              </div>
            </div>

            {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                ← Zpět
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Vytvářím...' : 'Vytvořit synchronizaci'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
