import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db/prisma'
import type Stripe from 'stripe'

const PLAN_BY_PRICE: Record<string, 'PRO' | 'BUSINESS'> = {
  [process.env.STRIPE_PRO_PRICE_ID ?? '']: 'PRO',
  [process.env.STRIPE_BUSINESS_PRICE_ID ?? '']: 'BUSINESS',
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = headers().get('stripe-signature')

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      if (!userId || !session.subscription) break

      const sub = await stripe.subscriptions.retrieve(session.subscription as string)
      const priceId = sub.items.data[0]?.price.id
      const plan = PLAN_BY_PRICE[priceId] ?? 'PRO'

      await upsertSubscription(userId, session.customer as string, sub, plan)
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.userId
      if (!userId) break
      const priceId = sub.items.data[0]?.price.id
      const plan = sub.status === 'active' ? (PLAN_BY_PRICE[priceId] ?? 'PRO') : 'FREE'
      await upsertSubscription(userId, sub.customer as string, sub, plan)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.userId
      if (!userId) break
      await prisma.user.updateMany({ where: { clerkId: userId }, data: { plan: 'FREE' } })
      await prisma.subscription.updateMany({
        where: { stripeCustomerId: sub.customer as string },
        data: { plan: 'FREE', status: 'CANCELLED', stripeSubscriptionId: null },
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
  plan: 'PRO' | 'BUSINESS' | 'FREE'
) {
  await prisma.user.updateMany({ where: { clerkId: clerkUserId }, data: { plan } })

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } })
  if (!user) return

  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: sub.items.data[0]?.price.id,
      plan,
      status: sub.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    },
    update: {
      stripeSubscriptionId: sub.id,
      stripePriceId: sub.items.data[0]?.price.id,
      plan,
      status: sub.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    },
  })
}
