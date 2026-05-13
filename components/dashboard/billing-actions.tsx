'use client'

import { useState } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'
import type { Plan } from '@prisma/client'

interface Props {
  plan: Plan
  customerId?: string | null
}

export function BillingActions({ plan, customerId }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    const res = await fetch('/api/billing/checkout', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setLoading(false)
  }

  async function handlePortal() {
    setLoading(true)
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setLoading(false)
  }

  if (plan === 'FREE') {
    return (
      <button onClick={handleUpgrade} disabled={loading}
        className="flex items-center gap-2 bg-white text-blue-700 font-semibold px-6 py-2.5 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50 text-sm">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? 'Přesměrování...' : 'Upgradovat na Pro — 990 Kč/měsíc'}
      </button>
    )
  }

  return (
    <button onClick={handlePortal} disabled={loading}
      className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 font-medium px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
      {loading ? 'Otevírám portál...' : 'Spravovat předplatné (Stripe portál)'}
    </button>
  )
}
