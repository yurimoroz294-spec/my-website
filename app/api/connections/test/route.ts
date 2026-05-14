import { getAuthUserId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCredentials } from '@/lib/kv'
import { RaynetClient } from '@/lib/integrations/raynet'
import { ShoptetClient } from '@/lib/integrations/shoptet'
import { PohodaClient } from '@/lib/integrations/pohoda'
import { PacketaClient } from '@/lib/integrations/packeta'
import { AirtableClient } from '@/lib/integrations/airtable'
import { MoneyS3Client } from '@/lib/integrations/money'
import { IDokladClient } from '@/lib/integrations/idoklad'
import { FakturoidClient } from '@/lib/integrations/fakturoid'
import { AbraFlexiClient } from '@/lib/integrations/abra'
import { testImapConnection } from '@/lib/integrations/imap'

export async function POST(req: Request) {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { platform } = await req.json()

  const conn = await prisma.connection.findFirst({ where: { userId: user.id, platform } })
  if (!conn) return NextResponse.json({ error: 'Connection not found', ok: false }, { status: 404 })

  const creds = await getCredentials(conn.kvKey)
  if (!creds) return NextResponse.json({ error: 'Credentials not found', ok: false }, { status: 404 })

  let ok = false
  try {
    switch (platform) {
      case 'RAYNET':     ok = await new RaynetClient(creds as any).testConnection(); break
      case 'SHOPTET':    ok = await new ShoptetClient(creds as any).testConnection(); break
      case 'POHODA':     ok = await new PohodaClient(creds as any).testConnection(); break
      case 'PACKETA':    ok = await new PacketaClient(creds as any).testConnection(); break
      case 'AIRTABLE': {
        const res = await new AirtableClient(creds as any).testConnection()
        ok = res.ok
        break
      }
      case 'MONEY_S3':   ok = await new MoneyS3Client(creds as any).testConnection(); break
      case 'IDOKLAD':    ok = await new IDokladClient(creds as any).testConnection(); break
      case 'FAKTUROID':  ok = await new FakturoidClient(creds as any).testConnection(); break
      case 'ABRA_FLEXI': ok = await new AbraFlexiClient(creds as any).testConnection(); break
      case 'EMAIL_IMAP': ok = await testImapConnection(creds as any); break
    }
  } catch (e) {
    ok = false
  }

  await prisma.connection.update({
    where: { id: conn.id },
    data: { lastTestOk: ok, lastTestedAt: new Date() },
  })

  return NextResponse.json({ ok, error: ok ? null : 'Nepodařilo se připojit. Zkontrolujte API klíče.' })
}
