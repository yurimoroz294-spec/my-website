import { getAuthUserId } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { getUsage } from '@/lib/usage'
import { formatDateTime } from '@/lib/utils'
import { Activity, Plug, RefreshCw, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const userId = await getAuthUserId()
  if (!userId) redirect('/sign-in')

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      connections: true,
      syncs: { include: { logs: { orderBy: { startedAt: 'desc' }, take: 1 } }, orderBy: { createdAt: 'desc' } },
    },
  })

  if (!user) redirect('/sign-in')

  const usage = await getUsage(user.id)
  const usageLimit = user.plan === 'FREE' ? 100 : Infinity
  const activeSyncs = user.syncs.filter(s => s.isActive).length
  const totalRecords = user.syncs.reduce((sum, s) => sum + (s.logs[0]?.recordsOut ?? 0), 0)

  const recentLogs = await prisma.syncLog.findMany({
    where: { sync: { userId: user.id } },
    include: { sync: { select: { name: true } } },
    orderBy: { startedAt: 'desc' },
    take: 8,
  })

  const STATUS_COLORS: Record<string, string> = {
    SUCCESS: 'bg-green-100 text-green-700',
    FAILED:  'bg-red-100 text-red-700',
    RUNNING: 'bg-blue-100 text-blue-700',
    PARTIAL: 'bg-yellow-100 text-yellow-700',
  }
  const STATUS_LABELS: Record<string, string> = {
    SUCCESS: 'OK',
    FAILED:  'Chyba',
    RUNNING: 'Běží',
    PARTIAL: 'Částečně',
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Přehled</h1>
        <p className="text-gray-500 mt-1 text-sm">Vítejte zpět, sledujte stav synchronizací</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Aktivní syncy', value: activeSyncs, icon: RefreshCw, color: 'text-blue-600 bg-blue-50' },
          { label: 'Propojení', value: user.connections.length, icon: Plug, color: 'text-green-600 bg-green-50' },
          { label: 'Syncy tento měsíc', value: usage.syncsRun, icon: Activity, color: 'text-purple-600 bg-purple-50' },
          { label: 'Záznamy zpracovány', value: totalRecords.toLocaleString('cs-CZ'), icon: TrendingUp, color: 'text-orange-600 bg-orange-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className={`inline-flex p-2 rounded-lg ${color} mb-3`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Usage bar (Free plan only) */}
      {user.plan === 'FREE' && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Využití Free plánu</span>
            <span className="text-sm text-gray-500">{usage.syncsRun} / 100 synců</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usage.syncsRun >= 90 ? 'bg-red-500' : usage.syncsRun >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, (usage.syncsRun / 100) * 100)}%` }}
            />
          </div>
          {usage.syncsRun >= 80 && (
            <p className="text-xs text-orange-600 mt-2">
              Blížíte se k limitu. <a href="/app/billing" className="underline font-medium">Upgradujte na Pro</a> pro neomezené syncy.
            </p>
          )}
        </div>
      )}

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Poslední aktivita</h2>
          <a href="/app/sync" className="text-sm text-blue-700 hover:underline">Zobrazit vše</a>
        </div>

        {recentLogs.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <RefreshCw className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Zatím žádné synchronizace.</p>
            <a href="/app/sync/create" className="text-sm text-blue-700 hover:underline mt-2 block">
              Vytvořit první sync →
            </a>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[log.status]}`}>
                    {STATUS_LABELS[log.status]}
                  </span>
                  <span className="text-sm text-gray-700">{log.sync.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  {log.recordsOut > 0 && <span>{log.recordsOut} záznamů</span>}
                  <span>{formatDateTime(log.startedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
