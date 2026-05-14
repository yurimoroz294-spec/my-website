import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { prisma } from '@/lib/db/prisma'

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    console.error('CLERK_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const headersList = headers()
  const svixId        = headersList.get('svix-id')
  const svixTimestamp = headersList.get('svix-timestamp')
  const svixSignature = headersList.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await req.text()

  let event: { type: string; data: Record<string, unknown> }
  try {
    const wh = new Webhook(secret)
    event = wh.verify(body, {
      'svix-id':        svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as typeof event
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  if (event.type === 'user.created') {
    const data = event.data as { id: string; email_addresses?: { email_address: string }[]; first_name?: string; last_name?: string }
    const email = data.email_addresses?.[0]?.email_address ?? ''
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null

    await prisma.user.upsert({
      where: { clerkId: data.id },
      create: { clerkId: data.id, email, name, plan: 'FREE' },
      update: { email, name },
    })
  }

  if (event.type === 'user.updated') {
    const data = event.data as { id: string; email_addresses?: { email_address: string }[]; first_name?: string; last_name?: string }
    const email = data.email_addresses?.[0]?.email_address ?? ''
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null

    await prisma.user.updateMany({
      where: { clerkId: data.id },
      data: { email, name },
    })
  }

  if (event.type === 'user.deleted') {
    const data = event.data as { id: string }
    await prisma.user.deleteMany({ where: { clerkId: data.id } })
  }

  return NextResponse.json({ received: true })
}
