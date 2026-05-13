import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db/prisma'

export async function POST() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { subscription: true },
  })

  const customerId = user?.subscription?.stripeCustomerId
  if (!customerId) return NextResponse.json({ error: 'No subscription found' }, { status: 404 })

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing`,
  })

  return NextResponse.json({ url: session.url })
}
