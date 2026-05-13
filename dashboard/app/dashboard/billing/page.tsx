import { createClient } from '@/lib/supabase/server'
import { PLANS } from '@/lib/stripe'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Profile } from '@/lib/supabase/types'
import { BillingActions } from './billing-actions'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileData } = await (supabase.from('profiles') as any)
    .select('plan, invoices_this_month, invoices_limit, stripe_customer_id')
    .eq('id', user!.id)
    .single()

  const profile = (profileData ?? {}) as {
    plan: string
    invoices_this_month: number
    invoices_limit: number
    stripe_customer_id: string | null
  }

  const currentPlan = profile.plan ?? 'starter'
  const used  = profile.invoices_this_month ?? 0
  const limit = profile.invoices_limit ?? 50
  const pct   = Math.min(Math.round((used / limit) * 100), 100)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fakturace a plán</h1>
        <p className="text-sm text-gray-500 mt-1">Spravujte své předplatné a sledujte spotřebu.</p>
      </div>

      {/* Current usage */}
      <Card>
        <CardHeader><CardTitle>Spotřeba tento měsíc</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Zpracované faktury</span>
            <span className="font-semibold">{used} / {limit === 999999 ? '∞' : limit}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct > 90 && (
            <p className="text-xs text-red-600 font-medium">
              ⚠️ Blížíte se měsíčnímu limitu. Upgradujte plán, aby zpracování nepřestalo.
            </p>
          )}
          <p className="text-xs text-gray-400">
            Čítač se resetuje 1. dne každého měsíce.
          </p>
        </CardContent>
      </Card>

      {/* Plan cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Dostupné plány</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentPlan
            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border-2 p-6 flex flex-col ${
                  plan.highlight
                    ? 'border-blue-500 shadow-lg shadow-blue-100'
                    : 'border-gray-200'
                } ${isCurrent ? 'bg-blue-50' : 'bg-white'}`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Nejoblíbenější
                  </span>
                )}

                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                    {isCurrent && <Badge variant="success">Váš plán</Badge>}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900">
                      {plan.priceMonthly === 0 ? 'Zdarma' : `${plan.priceMonthly} Kč`}
                    </span>
                    {plan.priceMonthly > 0 && (
                      <span className="text-sm text-gray-500">/ měsíc</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {plan.invoicesLimit === -1 ? 'Neomezený počet faktur' : `${plan.invoicesLimit} faktur / měsíc`}
                  </p>
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-blue-500 mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <BillingActions
                  planId={plan.id}
                  isCurrent={isCurrent}
                  isFree={plan.priceMonthly === 0}
                  hasCustomerId={!!profile.stripe_customer_id}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Manage subscription */}
      {profile.stripe_customer_id && currentPlan !== 'starter' && (
        <Card>
          <CardHeader><CardTitle>Správa předplatného</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              V zákaznickém portálu Stripe můžete změnit platební metodu, stáhnout faktury nebo zrušit předplatné.
            </p>
            <BillingActions planId="starter" isCurrent={false} isFree={false} hasCustomerId isPortal />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
