import Link from 'next/link'
import { CheckCircle, X } from 'lucide-react'

const PLANS = [
  {
    name: 'Free',
    price: 0,
    period: '/měsíc',
    desc: 'Pro začátek a testování',
    cta: 'Začít zdarma',
    href: '/sign-up',
    highlight: false,
    features: [
      { text: '100 synců / měsíc', ok: true },
      { text: '2 propojené platformy', ok: true },
      { text: '4 připravené šablony', ok: true },
      { text: 'Plánování (denní)', ok: true },
      { text: 'AI mapování polí', ok: false },
      { text: 'Real-time webhooks', ok: false },
      { text: 'Prioritní podpora', ok: false },
    ],
  },
  {
    name: 'Pro',
    price: 990,
    period: '/měsíc',
    desc: 'Pro aktivní e-shopy',
    cta: 'Začít Pro',
    href: '/sign-up?plan=pro',
    highlight: true,
    badge: 'Nejoblíbenější',
    features: [
      { text: 'Neomezené syncy', ok: true },
      { text: 'Všechny 4 platformy', ok: true },
      { text: '4 šablony + vlastní', ok: true },
      { text: 'Plánování (každých 5 min)', ok: true },
      { text: 'AI mapování polí (GPT)', ok: true },
      { text: 'Real-time webhooks', ok: true },
      { text: 'Airtable integrace', ok: true },
      { text: 'Email podpora', ok: true },
    ],
  },
  {
    name: 'Business',
    price: 2490,
    period: '/měsíc',
    desc: 'Pro větší týmy',
    cta: 'Kontaktovat',
    href: '/sign-up?plan=business',
    highlight: false,
    features: [
      { text: 'Neomezené syncy', ok: true },
      { text: 'Všechny platformy + custom', ok: true },
      { text: 'Vlastní šablony', ok: true },
      { text: 'Plánování (každou minutu)', ok: true },
      { text: 'AI OCR faktur (neomezeno)', ok: true },
      { text: 'Airtable (neomezené záznamy)', ok: true },
      { text: 'Slack / phone podpora', ok: true },
      { text: 'SLA 99,9 %', ok: true },
    ],
  },
]

export function LandingPricing() {
  return (
    <section id="cenik" className="py-20 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Jednoduchý ceník</h2>
          <p className="text-lg text-gray-600">Začněte zdarma. Upgradujte až když to potřebujete.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-8 relative ${
                plan.highlight
                  ? 'border-blue-500 shadow-xl shadow-blue-100 scale-105'
                  : 'border-gray-200 shadow-sm'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-700 text-white text-xs font-bold px-4 py-1 rounded-full">
                  {plan.badge}
                </div>
              )}

              <div className="mb-6">
                <div className="text-lg font-bold text-gray-900">{plan.name}</div>
                <div className="text-sm text-gray-500 mt-0.5">{plan.desc}</div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-gray-900">
                    {plan.price === 0 ? 'Zdarma' : `${plan.price.toLocaleString('cs-CZ')} Kč`}
                  </span>
                  {plan.price > 0 && <span className="text-gray-500 text-sm">{plan.period}</span>}
                </div>
                {plan.price > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    bez DPH · {(plan.price * 12).toLocaleString('cs-CZ')} Kč/rok
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map(f => (
                  <li key={f.text} className="flex items-center gap-2.5 text-sm">
                    {f.ok
                      ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      : <X className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    }
                    <span className={f.ok ? 'text-gray-700' : 'text-gray-400'}>{f.text}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`block text-center py-3 px-6 rounded-xl font-semibold text-sm transition-colors ${
                  plan.highlight
                    ? 'bg-blue-700 text-white hover:bg-blue-800'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-gray-400 mt-10">
          Platba kartou nebo bankovním převodem · Zrušení kdykoliv · Faktura s IČO/DIČ
        </p>
      </div>
    </section>
  )
}
