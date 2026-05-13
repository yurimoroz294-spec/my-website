'use client'

import { useState } from 'react'
import { CheckCircle, AlertCircle, Loader2, ExternalLink, Trash2 } from 'lucide-react'

interface PlatformField {
  key: string
  label: string
  placeholder: string
  type: string
}

interface Platform {
  id: string
  name: string
  desc: string
  emoji: string
  color: string
  badge?: string
  fields: PlatformField[]
  docsUrl: string
}

interface ConnectionCardProps {
  platform: Platform
  existing: { id: string; isActive: boolean; lastTestOk: boolean | null; lastTestedAt: Date | null } | null
  userId: string
}

export function ConnectionCard({ platform, existing }: ConnectionCardProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'saving' | 'testing' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(!existing)

  async function handleSave() {
    setState('saving')
    setError('')
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: platform.id, credentials: values }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Chyba při ukládání')
      }
      setState('saved')
      setShowForm(false)
      setTimeout(() => setState('idle'), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neznámá chyba')
      setState('error')
    }
  }

  async function handleTest() {
    setState('testing')
    try {
      const res = await fetch('/api/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: platform.id }),
      })
      const data = await res.json()
      setState(data.ok ? 'saved' : 'error')
      if (!data.ok) setError(data.error ?? 'Test se nezdařil')
    } catch {
      setState('error')
      setError('Nepodařilo se připojit')
    }
  }

  async function handleDelete() {
    if (!confirm(`Opravdu chcete odebrat propojení s ${platform.name}?`)) return
    await fetch('/api/connections', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: platform.id }),
    })
    window.location.reload()
  }

  return (
    <div className={`rounded-xl border-2 p-6 ${platform.color} transition-all`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{platform.emoji}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{platform.name}</span>
              {platform.badge && (
                <span className="text-xs font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                  {platform.badge}
                </span>
              )}
            </div>
            {existing ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                {existing.lastTestOk === true
                  ? <><CheckCircle className="h-3.5 w-3.5 text-green-500" /><span className="text-xs text-green-600">Připojeno</span></>
                  : existing.lastTestOk === false
                  ? <><AlertCircle className="h-3.5 w-3.5 text-red-500" /><span className="text-xs text-red-600">Chyba připojení</span></>
                  : <span className="text-xs text-gray-400">Uloženo (netestováno)</span>
                }
              </div>
            ) : (
              <span className="text-xs text-gray-400">Nepropojeno</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a href={platform.docsUrl} target="_blank" rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-600 transition-colors">
            <ExternalLink className="h-4 w-4" />
          </a>
          {existing && (
            <button onClick={handleDelete} className="text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-600 mb-4 leading-relaxed">{platform.desc}</p>

      {showForm ? (
        <div className="space-y-3">
          {platform.fields.map(field => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                value={values[field.key] ?? ''}
                onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}

          {error && (
            <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={state === 'saving'}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-700 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {state === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
              {state === 'saving' ? 'Ukládám...' : 'Uložit a připojit'}
            </button>
            {existing && (
              <button onClick={() => setShowForm(false)} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
                Zrušit
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={state === 'testing'}
            className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {state === 'testing' && <Loader2 className="h-4 w-4 animate-spin" />}
            {state === 'testing' ? 'Testuji...' : 'Otestovat připojení'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm text-blue-700 font-medium hover:underline"
          >
            Upravit
          </button>
        </div>
      )}
    </div>
  )
}
