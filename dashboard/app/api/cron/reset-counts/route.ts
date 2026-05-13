import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Runs on the 1st of each month at midnight (configured in vercel.json)
// Resets monthly invoice counter for all users
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('profiles') as any)
    .update({ invoices_this_month: 0 })
    .gte('id', '00000000-0000-0000-0000-000000000000') // match all rows

  if (error) {
    console.error('Monthly reset failed:', error)
    return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 })
  }

  console.log(`Monthly invoice counts reset at ${new Date().toISOString()}`)
  return NextResponse.json({ ok: true, resetAt: new Date().toISOString() })
}
