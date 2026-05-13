import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { getUsage } from '@/lib/usage'
import { formatDate, formatCZK } from '@/lib/utils'
import { CheckCircle, ExternalLink } from 'lucide-react'
import { BillingActions } from '@/components/dashboard/billing-actions'

const PLAN_FEATURES = {
  FREE:     ['100 synců / měsíc', '2 platformy', 'Základní šablony', 'Denní plánování'],
  PRO:      ['Neomezené syncy', 'Všechny 4 platformy', 'AI mapování polí', 'Plánování každých 5 min', 'Webhooks', 'Email podpora'],
  BUSINESS: ['Vše z Pro', 'Custom platformy', 'Neomezené AI OCR faktur', 'Slack / phone podpora', 'SLA 99,9 %'],
}

const PLAN_PRICES = { FREE: 0, PRO: 990, BUSINESS: 2490 }

export default async function BillingPage() {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { subscription: true },
  })
  if (!user) redirect('/sign-in')

  const usage = await getUsage(user.id)
  const usageLimit = user.plan === 'FREE' ? 100 : null

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Předplatné & fakturace</h1>
        <p className="text-gray-500 mt-1 text-sm">Spravujte plán, platební metody a historii faktur</p>
      </div>

      {/* Current plan */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-gray-500 mb-1">Aktuální plán</div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-gray-900">{user.plan}</span>
              {user.plan !== 'FREE' && (
                <span className="text-sm bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">Aktivní</span>
              )}
            </div>
            <div className="text-lg font-semibold text-gray-700 mt-1">
              {PLAN_PRICES[user.plan] === 0 ? 'Zdarma' : `${formatCZK(PLAN_PRICES[user.plan])} / měsíc`}
            </div>
          </div>

          {user.subscription?.currentPeriodEnd && (
            <div className="text-right text-sm text-gray-500">
              <div>Další platba</div>
              <div className="font-medium text-gray-700">{formatDate(user.subscription.currentPeriodEnd)}</div>
            </div>
          )}
        </div>

        <ul className="mt-4 space-y-1.5">
          {PLAN_FEATURES[user.plan].map(f => (
            <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Usage */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Využití v tomto měsíci</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">Syncy</div>
            <div className="text-2xl font-bold text-gray-900">
              {usage.syncsRun}
              {usageLimit && <span className="text-base font-normal text-gray-400"> / {usageLimit}</span>}
            </div>
            {usageLimit && (
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${usage.syncsRun >= 90 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(100, (usage.syncsRun / usageLimit) * 100)}%` }}
                />
              </div>
            )}
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Záznamy zpracovány</div>
            <div className="text-2xl font-bold text-gray-900">
              {usage.recordsProcessed.toLocaleString('cs-CZ')}
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade CTA */}
      {user.plan === 'FREE' && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white mb-6">
          <h2 className="text-lg font-bold mb-2">Upgradujte na Pro za 990 Kč/měsíc</h2>
          <p className="text-blue-100 text-sm mb-4">Neomezené syncy, AI mapování polí, plánování každých 5 minut.</p>
          <BillingActions plan={user.plan} customerId={user.subscription?.stripeCustomerId} />
        </div>
      )}

      {/* Manage subscription */}
      {user.plan !== 'FREE' && user.subscription?.stripeCustomerId && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Správa předplatného</h2>
          <BillingActions plan={user.plan} customerId={user.subscription.stripeCustomerId} />
          <p className="text-xs text-gray-400 mt-3">
            Zrušením předplatného ztratíte přístup k Pro funkcím na konci fakturačního období.
            Faktura s IČO/DIČ je dostupná v portálu Stripe.
          </p>
        </div>
      )}
    </div>
  )
}
