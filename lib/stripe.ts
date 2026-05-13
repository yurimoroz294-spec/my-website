import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
  typescript: true,
})

export const PLANS = {
  FREE: {
    name: 'Free',
    czk: 0,
    priceId: null,
    syncs: 100,
    label: 'Zdarma',
  },
  PRO: {
    name: 'Pro',
    czk: 990,
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    syncs: Infinity,
    label: 'Pro',
  },
  BUSINESS: {
    name: 'Business',
    czk: 2490,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID!,
    syncs: Infinity,
    label: 'Business',
  },
} as const

export async function createOrRetrieveCustomer(userId: string, email: string): Promise<string> {
  const { prisma } = await import('./db/prisma')

  const sub = await prisma.subscription.findUnique({ where: { userId } })
  if (sub?.stripeCustomerId) return sub.stripeCustomerId

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  })

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, stripeCustomerId: customer.id, plan: 'FREE' },
    update: { stripeCustomerId: customer.id },
  })

  return customer.id
}
