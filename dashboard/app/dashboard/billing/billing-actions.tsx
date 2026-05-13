'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { PlanId } from '@/lib/stripe'
import { useEffect } from 'react'

export function BillingActions({
  planId,
  isCurrent,
  isFree,
  hasCustomerId,
  isPortal = false,
}: {
  planId: PlanId
  isCurrent: boolean
  isFree: boolean
  hasCustomerId: boolean
  isPortal?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (searchParams.get('success') === '1') {
      setMsg({ type: 'success', text: 'Předplatné bylo aktivováno! Děkujeme.' })
      router.replace('/dashboard/billing')
    }
    if (searchParams.get('cancelled') === '1') {
      setMsg({ type: 'error', text: 'Platba byla zrušena.' })
      router.replace('/dashboard/billing')
    }
  }, [searchParams, router])

  async function openPortal() {
    setLoading(true)
    setMsg(null)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setMsg({ type: 'error', text: data.error }); setLoading(false); return }
    window.location.href = data.url
  }

  async function startCheckout() {
    setLoading(true)
    setMsg(null)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    })
    const data = await res.json()
    if (!res.ok) { setMsg({ type: 'error', text: data.error }); setLoading(false); return }
    window.location.href = data.url
  }

  if (isPortal) {
    return (
      <div>
        {msg && (
          <p className={`mb-3 text-sm ${msg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {msg.text}
          </p>
        )}
        <Button variant="secondary" loading={loading} onClick={openPortal}>
          Spravovat předplatné →
        </Button>
      </div>
    )
  }

  if (isCurrent) {
    return (
      <div>
        {msg && (
          <p className={`mb-2 text-sm ${msg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {msg.text}
          </p>
        )}
        <Button className="w-full" variant="ghost" disabled>
          Váš aktuální plán
        </Button>
      </div>
    )
  }

  if (isFree) {
    // Downgrade to starter — handled via portal cancellation
    return (
      <Button className="w-full" variant="ghost" disabled>
        Kontaktujte podporu
      </Button>
    )
  }

  return (
    <div>
      {msg && (
        <p className={`mb-2 text-sm ${msg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {msg.text}
        </p>
      )}
      <Button className="w-full" loading={loading} onClick={startCheckout}>
        Upgradovat →
      </Button>
    </div>
  )
}
