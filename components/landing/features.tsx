import { Zap, Brain, Shield, Clock, BarChart3, RefreshCw } from 'lucide-react'

const FEATURES = [
  {
    icon: Zap,
    title: 'Nastavení za 5 minut',
    desc: 'Zadejte API klíče, vyberte šablonu a spusťte sync. Žádné programování, žádný IT oddíl.',
    color: 'text-yellow-600 bg-yellow-50',
  },
  {
    icon: Brain,
    title: 'AI mapování polí',
    desc: 'GPT-4o-mini automaticky navrhne mapování polí a parsuje PDF faktury. IČO, DIČ, variabilní symbol — vše automaticky.',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    icon: Shield,
    title: 'Bezpečnost & GDPR',
    desc: 'API klíče šifrované AES-256. Veškerá data zůstávají v EU (Frankfurt). GDPR-compliant od základu.',
    color: 'text-green-600 bg-green-50',
  },
  {
    icon: Clock,
    title: 'Automatický plán',
    desc: 'Naplánujte sync každých 5 minut, hodinově nebo denně. Real-time webhooks pro okamžité aktualizace.',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: BarChart3,
    title: 'Logy & monitoring',
    desc: 'Sledujte každý sync v reálném čase. Chybové hlášky s přesným popisem. Výpis zpracovaných záznamů.',
    color: 'text-orange-600 bg-orange-50',
  },
  {
    icon: RefreshCw,
    title: 'Česká specifika',
    desc: 'Nativní podpora IČO, DIČ, variabilního symbolu a sazeb DPH (0 %, 10 %, 12 %, 21 %). Přizpůsobeno ČR.',
    color: 'text-red-600 bg-red-50',
  },
]

export function LandingFeatures() {
  return (
    <section id="funkce" className="py-20 px-4 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Vše, co potřebujete pro automatizaci
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Navrženo speciálně pro české SMB e-shopy s 5–50 zaměstnanci.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className={`inline-flex p-2.5 rounded-lg ${color} mb-4`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
