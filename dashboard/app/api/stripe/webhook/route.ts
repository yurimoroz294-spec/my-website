import { NextRequest, NextResponse } from 'next/server'
import { stripe, getPlanByPriceId, type PlanId } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import type Stripe from 'stripe'

// Disable body parsing — Stripe requires raw body for signature verification
export const config = { api: { bodyParser: false } }

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Webhook error'
    console.error('Stripe webhook signature error:', msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const supabase = await createServiceClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      const planId = session.metadata?.plan_id as PlanId | undefined
      if (userId && planId) {
        await activatePlan(supabase, userId, planId, session.customer as string)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id
      if (!userId) break
      const priceId = sub.items.data[0]?.price?.id
      const plan = priceId ? getPlanByPriceId(priceId) : undefined
      if (plan) {
        await activatePlan(supabase, userId, plan.id, sub.customer as string)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id
      if (userId) {
        // Downgrade to starter on cancellation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({
            plan: 'starter',
            invoices_limit: 50,
            stripe_subscription_id: null,
          })
          .eq('id', userId)
      }
      break
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice
      const customerId = inv.customer as string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profileData } = await (supabase.from('profiles') as any)
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()
      if (profileData) {
        console.warn(`Payment failed for user ${(profileData as { id: string }).id}`)
      }
      break
    }

    default:
      // Unhandled event — ignore
      break
  }

  return NextResponse.json({ received: true })
}

async function activatePlan(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  planId: PlanId,
  customerId: string,
) {
  const LIMITS: Record<PlanId, number> = { starter: 50, pro: 500, enterprise: 999999 }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('profiles') as any)
    .update({
      plan: planId,
      invoices_limit: LIMITS[planId],
      stripe_customer_id: customerId,
    })
    .eq('id', userId)
}
