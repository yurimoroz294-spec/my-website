import Link from 'next/link'
import { ArrowRight, CheckCircle, Zap } from 'lucide-react'

const PROOF_POINTS = [
  'Žádné programování',
  'Nastavení za 5 minut',
  'Data v EU (GDPR)',
  'Česká podpora',
]

export function LandingHero() {
  return (
    <section className="relative bg-gradient-to-b from-blue-50 to-white pt-20 pb-28 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <Zap className="h-3.5 w-3.5" />
          No-code integrace pro české e-shopy
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
          Automatizujte faktury<br />
          a objednávky do CRM{' '}
          <span className="text-blue-700">za 5 minut</span>
        </h1>

        <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          Propojte <strong>RAYNET CRM</strong>, <strong>Pohoda</strong>, <strong>Shoptet</strong> a <strong>Packeta</strong> bez
          jediného řádku kódu. Konec ručního zadávání faktur a objednávek.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center gap-2 bg-blue-700 text-white text-lg font-semibold px-8 py-4 rounded-xl hover:bg-blue-800 transition-colors shadow-lg shadow-blue-200"
          >
            Začít zdarma
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="#demo"
            className="inline-flex items-center justify-center gap-2 bg-white text-gray-700 text-lg font-semibold px-8 py-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:text-blue-700 transition-colors"
          >
            Ukázat demo
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2">
          {PROOF_POINTS.map(point => (
            <div key={point} className="flex items-center gap-1.5 text-sm text-gray-600">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              {point}
            </div>
          ))}
        </div>
      </div>

      {/* Hero visual */}
      <div className="mt-16 max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 flex items-center gap-2 border-b border-gray-100">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 text-center text-xs text-gray-400">app.czechdatasync.cz</div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: 'Shoptet → RAYNET', desc: 'Objednávky synced', count: '1 247', status: 'active', color: 'green' },
              { title: 'Pohoda → RAYNET', desc: 'Faktury synced', count: '384', status: 'active', color: 'green' },
              { title: 'Packeta → Shoptet', desc: 'Tracking updates', count: '89', status: 'running', color: 'blue' },
            ].map(item => (
              <div key={item.title} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500">{item.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    item.color === 'green' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {item.status === 'active' ? 'aktivní' : 'běží...'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{item.count}</div>
                <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
                <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.color === 'green' ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: item.color === 'green' ? '100%' : '60%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
