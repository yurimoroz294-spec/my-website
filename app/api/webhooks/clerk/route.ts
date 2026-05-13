import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db/prisma'

export async function POST(req: Request) {
  const body = await req.json()
  const eventType = body.type

  if (eventType === 'user.created') {
    const { id, email_addresses } = body.data
    const email = email_addresses?.[0]?.email_address ?? ''

    await prisma.user.upsert({
      where: { clerkId: id },
      create: { clerkId: id, email, plan: 'FREE' },
      update: { email },
    })
  }

  if (eventType === 'user.deleted') {
    const { id } = body.data
    await prisma.user.deleteMany({ where: { clerkId: id } })
  }

  return NextResponse.json({ received: true })
}
