import { getAuthUserId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { stripe, createOrRetrieveCustomer, PLANS } from '@/lib/stripe'

export async function POST() {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let email = ''
  try {
    const { currentUser } = await import('@clerk/nextjs/server')
    const clerkUser = await currentUser()
    email = clerkUser?.emailAddresses[0]?.emailAddress ?? ''
  } catch {
    // Clerk not configured — email stays empty
  }

  const customerId = await createOrRetrieveCustomer(userId, email)

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: PLANS.PRO.priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing`,
    currency: 'czk',
    locale: 'cs',
    metadata: { userId },
    subscription_data: { metadata: { userId } },
  })

  return NextResponse.json({ url: session.url })
}
