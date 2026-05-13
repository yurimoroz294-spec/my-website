import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

export type PlanId = 'starter' | 'pro' | 'enterprise'

export interface Plan {
  id: PlanId
  name: string
  priceMonthly: number       // CZK
  currency: string
  invoicesLimit: number      // -1 = unlimited
  features: string[]
  stripePriceId: string | null  // null = free plan
  highlight?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 0,
    currency: 'CZK',
    invoicesLimit: 50,
    stripePriceId: null,
    features: [
      '50 faktur / měsíc',
      'Gmail + IMAP připojení',
      'Pohoda XML export',
      'ARES validace',
      'E-mailová podpora',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 490,
    currency: 'CZK',
    invoicesLimit: 500,
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
    highlight: true,
    features: [
      '500 faktur / měsíc',
      'Vše ze Starter',
      'Fakturoid + iDoklad API',
      'Pohoda mServer',
      'Prioritní podpora',
      'Statistiky a exporty',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 1490,
    currency: 'CZK',
    invoicesLimit: -1,
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
    features: [
      'Neomezený počet faktur',
      'Vše z Pro',
      'Vlastní CRM integrace',
      'SLA 99.9%',
      'Dedikovaný account manager',
      'Onboarding a školení',
    ],
  },
]

export function getPlanById(id: PlanId): Plan {
  return PLANS.find(p => p.id === id) ?? PLANS[0]
}

export function getPlanByPriceId(priceId: string): Plan | undefined {
  return PLANS.find(p => p.stripePriceId === priceId)
}

// Create or retrieve Stripe customer for a user
export async function getOrCreateCustomer(
  userId: string,
  email: string,
  existingCustomerId?: string | null,
): Promise<string> {
  if (existingCustomerId) return existingCustomerId

  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId },
  })
  return customer.id
}
