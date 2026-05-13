'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function InvoiceActions({
  invoiceId,
  invoiceNumber,
}: {
  invoiceId: string
  invoiceNumber: string | null
}) {
  const router = useRouter()
  const [reprocessing, setReprocessing] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function reprocess() {
    setReprocessing(true)
    setMsg(null)
    try {
      const res = await fetch('/api/process/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Chyba')
      setMsg({ type: 'success', text: 'Znovu zpracováno.' })
      router.refresh()
    } catch (err: unknown) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Chyba' })
    } finally {
      setReprocessing(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2 shrink-0">
      <div className="flex gap-2">
        <a
          href={`/api/invoices/${invoiceId}/pohoda-xml`}
          download={`pohoda-${invoiceNumber ?? invoiceId}.xml`}
        >
          <Button variant="secondary" size="sm">
            ⬇ Pohoda XML
          </Button>
        </a>
        <Button
          variant="secondary"
          size="sm"
          loading={reprocessing}
          onClick={reprocess}
        >
          🔄 Znovu zpracovat
        </Button>
      </div>
      {msg && (
        <span className={`text-xs ${msg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {msg.text}
        </span>
      )}
    </div>
  )
}
