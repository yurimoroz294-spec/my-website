import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import type { Profile } from '@/lib/supabase/types'

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileData } = await (supabase.from('profiles') as any)
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const profile = profileData as { stripe_customer_id: string | null } | null

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'Nemáte aktivní předplatné.' }, { status: 400 })
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id!,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
  })

  return NextResponse.json({ url: portal.url })
}
