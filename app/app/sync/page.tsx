import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import Link from 'next/link'
import { Plus, Play, Pause, Trash2, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { SYNC_TEMPLATES } from '@/lib/sync/templates'

const STATUS_CONFIG = {
  SUCCESS: { icon: CheckCircle, color: 'text-green-500', label: 'Úspěch' },
  FAILED:  { icon: XCircle,     color: 'text-red-500',   label: 'Chyba' },
  RUNNING: { icon: Loader2,     color: 'text-blue-500',  label: 'Běží' },
  PARTIAL: { icon: Clock,       color: 'text-yellow-500', label: 'Částečně' },
}

const SCHEDULE_LABELS: Record<string, string> = {
  MANUAL:      'Manuálně',
  EVERY_5MIN:  'Každých 5 min',
  EVERY_HOUR:  'Každou hodinu',
  DAILY:       'Denně',
  WEEKLY:      'Týdně',
}

export default async function SyncPage() {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect('/sign-in')

  const syncs = await prisma.sync.findMany({
    where: { userId: user.id },
    include: {
      sourceConnection: true,
      targetConnection: true,
      logs: { orderBy: { startedAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Synchronizace</h1>
          <p className="text-gray-500 mt-1 text-sm">Spravujte a sledujte všechna synchronizační pravidla</p>
        </div>
        <Link
          href="/app/sync/create"
          className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nový sync
        </Link>
      </div>

      {/* Templates quick-start */}
      {syncs.length === 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Připravené šablony</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SYNC_TEMPLATES.map(t => (
              <Link key={t.id} href={`/app/sync/create?template=${t.id}`}
                className="bg-white rounded-xl border border-gray-100 p-5 hover:border-blue-300 hover:shadow-md transition-all group">
                <div className="text-2xl mb-3">{t.icon}</div>
                <div className="font-medium text-gray-900 text-sm group-hover:text-blue-700 transition-colors">{t.name}</div>
                <div className="text-xs text-gray-500 mt-1.5 leading-relaxed">{t.description.slice(0, 80)}...</div>
                {t.popular && (
                  <div className="mt-3 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full inline-block font-medium">Oblíbené</div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Syncs list */}
      {syncs.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {syncs.map(sync => {
              const lastLog = sync.logs[0]
              const statusConf = lastLog ? STATUS_CONFIG[lastLog.status] : null
              const template = SYNC_TEMPLATES.find(t => t.id === sync.templateId)

              return (
                <div key={sync.id} className="flex items-center justify-between p-5 hover:bg-gray-50 group">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{template?.icon ?? '⚙️'}</span>
                    <div>
                      <div className="font-medium text-gray-900">{sync.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {sync.sourceConnection.platform} → {sync.targetConnection.platform}
                        {' · '}{SCHEDULE_LABELS[sync.schedule]}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {statusConf && lastLog && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <statusConf.icon className={`h-4 w-4 ${statusConf.color} ${lastLog.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                        <span>{statusConf.label}</span>
                        {lastLog.recordsOut > 0 && <span className="text-gray-400">({lastLog.recordsOut} záznamů)</span>}
                        <span className="text-gray-300">{formatDateTime(lastLog.startedAt)}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <SyncActionButton syncId={sync.id} isActive={sync.isActive} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">⚙️</div>
          <h3 className="font-semibold text-gray-900 mb-2">Žádné synchronizace</h3>
          <p className="text-sm text-gray-500 mb-6">Začněte jednou ze šablon výše nebo vytvořte vlastní sync.</p>
          <Link href="/app/sync/create" className="inline-flex items-center gap-2 bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors">
            <Plus className="h-4 w-4" />
            Vytvořit první sync
          </Link>
        </div>
      )}
    </div>
  )
}

function SyncActionButton({ syncId, isActive }: { syncId: string; isActive: boolean }) {
  return (
    <form action={`/api/syncs/${syncId}/run`} method="POST">
      <button type="submit" className="p-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-medium flex items-center gap-1">
        <Play className="h-3.5 w-3.5" />
        Spustit
      </button>
    </form>
  )
}
