import { redirect } from 'next/navigation'
import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { getOrCreateInboxToken, getInboxEmail } from '@/lib/invoices'
import { InvoicesClient } from './invoices-client'

export default async function InvoicesPage() {
  const clerkId = await getAuthUserId()
  if (!clerkId) redirect('/sign-in')

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) redirect('/sign-in')

  if (user.plan === 'FREE') {
    return (
      <div className="p-8 max-w-xl">
        <h1 className="text-xl font-semibold mb-2">Inbox faktur</h1>
        <p className="text-gray-600 mb-4">
          Automatické přijímání faktur e-mailem je dostupné od <strong>Pro plánu</strong>.
        </p>
        <a
          href="/app/billing"
          className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          Přejít na předplatné
        </a>
      </div>
    )
  }

  const token = await getOrCreateInboxToken(user.id)
  const inboxEmail = getInboxEmail(token)

  const invoices = await prisma.invoice.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  // Serialize Date objects to ISO strings for client component
  const serialized = JSON.parse(JSON.stringify(invoices))

  return (
    <InvoicesClient
      inboxEmail={inboxEmail}
      initialInvoices={serialized}
      autoSend={user.autoSendInvoices}
    />
  )
}
