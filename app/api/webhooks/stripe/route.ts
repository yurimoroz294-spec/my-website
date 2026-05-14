import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db/prisma'
import type Stripe from 'stripe'

function planForPriceId(priceId: string | undefined): 'PRO' | 'BUSINESS' | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'PRO'
  if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) return 'BUSINESS'
  return null
}

// 'trialing' and 'past_due' keep paid plan active; only 'canceled', 'unpaid',
// 'incomplete_expired' drop the user back to FREE.
function planForStatus(status: Stripe.Subscription.Status, paidPlan: 'PRO' | 'BUSINESS'): 'PRO' | 'BUSINESS' | 'FREE' {
  if (status === 'active' || status === 'trialing' || status === 'past_due') return paidPlan
  return 'FREE'
}

function dbStatusFor(status: Stripe.Subscription.Status): 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING' {
  if (status === 'active') return 'ACTIVE'
  if (status === 'trialing') return 'TRIALING'
  if (status === 'past_due') return 'PAST_DUE'
  return 'CANCELLED'
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const body = await req.text()
  const sig = headers().get('stripe-signature')

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      const customerId = typeof session.customer === 'string' ? session.customer : null
      if (!userId || !session.subscription || !customerId) {
        console.error('checkout.session.completed missing userId/customer/subscription', { eventId: event.id })
        break
      }

      const sub = await stripe.subscriptions.retrieve(
        typeof session.subscription === 'string' ? session.subscription : session.subscription.id,
      )
      const priceId = sub.items.data[0]?.price.id
      const paidPlan = planForPriceId(priceId)
      if (!paidPlan) {
        console.error('Unknown priceId in checkout session', { priceId, eventId: event.id })
        return NextResponse.json({ error: 'Unknown price' }, { status: 400 })
      }
      await upsertSubscription(userId, customerId, sub, paidPlan)
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.userId
      const customerId = typeof sub.customer === 'string' ? sub.customer : null
      if (!userId || !customerId) {
        console.error('subscription.updated missing userId/customer', { eventId: event.id })
        break
      }
      const priceId = sub.items.data[0]?.price.id
      const paidPlan = planForPriceId(priceId)
      if (!paidPlan) {
        console.error('Unknown priceId in subscription.updated', { priceId, eventId: event.id })
        return NextResponse.json({ error: 'Unknown price' }, { status: 400 })
      }
      const plan = planForStatus(sub.status, paidPlan)
      await upsertSubscription(userId, customerId, sub, plan)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.userId
      const customerId = typeof sub.customer === 'string' ? sub.customer : null
      if (!userId || !customerId) break
      await prisma.user.updateMany({ where: { clerkId: userId }, data: { plan: 'FREE' } })
      await prisma.subscription.updateMany({
        where: { stripeCustomerId: customerId, userId: (await prisma.user.findUnique({ where: { clerkId: userId } }))?.id ?? '' },
        data: { plan: 'FREE', status: 'CANCELLED', stripeSubscriptionId: null },
      })
      break
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice
      const customerId = typeof inv.customer === 'string' ? inv.customer : null
      if (!customerId) break
      await prisma.subscription.updateMany({
        where: { stripeCustomerId: customerId },
        data: { status: 'PAST_DUE' },
      })
      break
    }
  }

  return NextResponse.json({ received: true })
}

async function upsertSubscription(
  clerkUserId: string,
  customerId: string,
  sub: Stripe.Subscription,
  plan: 'PRO' | 'BUSINESS' | 'FREE',
) {
  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } })
  if (!user) {
    console.error('Stripe webhook: user not found for clerkId', clerkUserId)
    return
  }

  // Verify the customer ID matches an existing record if we already have one —
  // prevents a webhook with mismatched metadata from hijacking another user.
  const existing = await prisma.subscription.findUnique({ where: { userId: user.id } })
  if (existing && existing.stripeCustomerId !== customerId) {
    console.error('Stripe customer mismatch', { userId: user.id, expected: existing.stripeCustomerId, got: customerId })
    return
  }

  await prisma.user.update({ where: { id: user.id }, data: { plan } })

  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: sub.items.data[0]?.price.id,
      plan,
      status: dbStatusFor(sub.status),
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    },
    update: {
      stripeSubscriptionId: sub.id,
      stripePriceId: sub.items.data[0]?.price.id,
      plan,
      status: dbStatusFor(sub.status),
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    },
  })
}
