import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { storeCredentials, deleteCredentials } from '@/lib/kv'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const PostSchema = z.object({
  platform: z.enum(['RAYNET', 'SHOPTET', 'POHODA', 'PACKETA']),
  credentials: z.record(z.string()),
})

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const connections = await prisma.connection.findMany({
    where: { userId: user.id },
    select: { id: true, platform: true, name: true, isActive: true, lastTestOk: true, lastTestedAt: true },
  })
  return NextResponse.json({ connections })
}

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { platform, credentials } = parsed.data

  const kvKey = `${user.id}-${platform}-${randomUUID()}`
  await storeCredentials(kvKey, credentials)

  const connection = await prisma.connection.upsert({
    where: { userId_platform: { userId: user.id, platform } },
    create: { userId: user.id, platform, name: `${platform} — ${user.email}`, kvKey, isActive: true },
    update: { kvKey, isActive: true, lastTestOk: null, lastTestedAt: null },
  })

  return NextResponse.json({ connection: { id: connection.id, platform } })
}

export async function DELETE(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const platform = body.platform as string

  const conn = await prisma.connection.findFirst({ where: { userId: user.id, platform: platform as any } })
  if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  await deleteCredentials(conn.kvKey)
  await prisma.connection.delete({ where: { id: conn.id } })

  return NextResponse.json({ ok: true })
}
