import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { SyncWizard } from '@/components/sync/wizard'
import { SYNC_TEMPLATES } from '@/lib/sync/templates'

interface Props {
  searchParams: { template?: string }
}

export default async function CreateSyncPage({ searchParams }: Props) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect('/sign-in')

  const connections = await prisma.connection.findMany({ where: { userId: user.id } })
  const template = SYNC_TEMPLATES.find(t => t.id === searchParams.template)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Nová synchronizace</h1>
        <p className="text-gray-500 mt-1 text-sm">Nakonfigurujte zdroj, cíl, mapování polí a plán spouštění</p>
      </div>
      <SyncWizard
        connections={connections.map(c => ({ id: c.id, platform: c.platform, name: c.name }))}
        template={template ?? null}
        userPlan={user.plan}
      />
    </div>
  )
}
