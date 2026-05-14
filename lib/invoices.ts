import { randomBytes } from 'crypto'
import { prisma } from './db/prisma'

const INBOX_DOMAIN = process.env.INVOICE_INBOX_DOMAIN ?? 'inbound.czechdatasync.cz'

export function getInboxEmail(token: string): string {
  return `faktury+${token}@${INBOX_DOMAIN}`
}

export async function getOrCreateInboxToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { inboxToken: true } })
  if (user?.inboxToken) return user.inboxToken

  const token = randomBytes(12).toString('hex')
  await prisma.user.update({ where: { id: userId }, data: { inboxToken: token } })
  return token
}

export async function getUserByInboxToken(token: string) {
  return prisma.user.findUnique({ where: { inboxToken: token } })
}
