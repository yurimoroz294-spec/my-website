import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { suggestFieldMapping } from '@/lib/ai/mapper'

const PLATFORM_FIELDS: Record<string, string[]> = {
  RAYNET: ['company.name', 'company.regNumber', 'company.taxNumber', 'company.email', 'company.phone',
    'businessCase.name', 'businessCase.totalAmount', 'businessCase.currency',
    'businessCase.customFields.variabilniSymbol', 'invoice.variableSymbol', 'invoice.totalAmount', 'invoice.dueDate'],
  SHOPTET: ['billing.company', 'billing.ico', 'billing.dic', 'billing.email', 'billing.phone',
    'billing.street', 'billing.city', 'billing.zip', 'code', 'totalPriceWithVat',
    'variableSymbol', 'currency', 'status', 'note'],
  POHODA: ['symVar', 'ico', 'dic', 'company', 'date', 'dateDue', 'homeCurrency.priceNone',
    'homeCurrency.priceHighSummary', 'vatRate', 'currency'],
  PACKETA: ['id', 'barcode', 'status', 'statusDate', 'recipientName', 'recipientEmail', 'cod', 'weight'],
}

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (user.plan === 'FREE') {
    return NextResponse.json({ error: 'AI mapování vyžaduje Pro plán.' }, { status: 403 })
  }

  const { sourcePlatform, targetPlatform } = await req.json()
  const sourceFields = PLATFORM_FIELDS[sourcePlatform] ?? []
  const targetFields = PLATFORM_FIELDS[targetPlatform] ?? []

  const mapping = await suggestFieldMapping(sourceFields, targetFields, sourcePlatform, targetPlatform)
  return NextResponse.json({ mapping })
}
