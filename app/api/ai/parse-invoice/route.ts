import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { parseInvoiceText, parseInvoiceFromBase64 } from '@/lib/ai/mapper'

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (user.plan === 'FREE') {
    return NextResponse.json({ error: 'AI parsování faktur vyžaduje Pro plán.' }, { status: 403 })
  }

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const { text } = await req.json()
    const invoice = await parseInvoiceText(text)
    return NextResponse.json({ invoice })
  }

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const invoice = await parseInvoiceFromBase64(base64, file.type)
    return NextResponse.json({ invoice })
  }

  return NextResponse.json({ error: 'Invalid content type' }, { status: 400 })
}
