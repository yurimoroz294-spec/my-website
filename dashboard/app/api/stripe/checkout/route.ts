import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, getOrCreateCustomer, getPlanById, type PlanId } from '@/lib/stripe'
import type { Profile } from '@/lib/supabase/types'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { planId } = await request.json() as { planId: PlanId }
  const plan = getPlanById(planId)

  if (!plan.stripePriceId) {
    return NextResponse.json({ error: 'Tento plán je zdarma.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileData } = await (supabase.from('profiles') as any)
    .select('stripe_customer_id, plan')
    .eq('id', user.id)
    .single()

  const profile = profileData as { stripe_customer_id: string | null; plan: string } | null

  const customerId = await getOrCreateCustomer(
    user.id,
    user.email!,
    profile?.stripe_customer_id,
  )

  // Persist customer ID if freshly created
  if (!profile?.stripe_customer_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any)
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/billing?success=1`,
    cancel_url: `${appUrl}/dashboard/billing?cancelled=1`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { supabase_user_id: user.id, plan_id: planId },
    },
    metadata: { supabase_user_id: user.id, plan_id: planId },
    locale: 'cs',
  })

  return NextResponse.json({ url: session.url })
}
