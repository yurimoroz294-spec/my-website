import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ProcessingLog } from '@/lib/supabase/types'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get('invoice_id')
  const status    = searchParams.get('status')   // success | error | info | warning
  const limit     = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('processing_logs') as any)
    .select('*, invoices(invoice_number, supplier_name, attachment_filename)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (invoiceId) query = query.eq('invoice_id', invoiceId)
  if (status)    query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 })

  return NextResponse.json(data as ProcessingLog[])
}
