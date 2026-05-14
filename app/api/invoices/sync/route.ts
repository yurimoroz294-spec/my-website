import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { pollUserInbox } from '@/lib/email-poller'

export async function POST() {
  const clerkId = await getAuthUserId()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (user.plan === 'FREE') {
    return NextResponse.json({ error: 'Synchronizace emailu vyžaduje plán Pro.' }, { status: 403 })
  }

  const conn = await prisma.connection.findFirst({
    where: { userId: user.id, platform: 'EMAIL_IMAP', isActive: true },
  })
  if (!conn) {
    return NextResponse.json(
      { error: 'Nemáte aktivní propojení e-mailového účtu. Přidejte ho v záložce Propojení.' },
      { status: 400 },
    )
  }

  const result = await pollUserInbox(user.id)
  return NextResponse.json(result)
}
