export function LandingIntegrations() {
  const integrations = [
    { name: 'RAYNET CRM', desc: 'Český CRM lídr', emoji: '📊', color: 'bg-orange-50 border-orange-100' },
    { name: 'Shoptet',    desc: 'E-shop platforma',   emoji: '🛒', color: 'bg-green-50 border-green-100' },
    { name: 'Pohoda',     desc: 'Účetní software',    emoji: '📄', color: 'bg-blue-50 border-blue-100' },
    { name: 'Packeta',    desc: 'Zásilkovna doručení', emoji: '📦', color: 'bg-purple-50 border-purple-100' },
  ]

  return (
    <section id="integrace" className="py-16 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-sm font-medium text-gray-400 uppercase tracking-wider mb-8">
          Propojujeme nejpoužívanější české platformy
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {integrations.map(i => (
            <div key={i.name} className={`rounded-xl border p-6 text-center ${i.color}`}>
              <div className="text-4xl mb-3">{i.emoji}</div>
              <div className="font-semibold text-gray-900">{i.name}</div>
              <div className="text-xs text-gray-500 mt-1">{i.desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            4 aktivní integrace
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            REST + XML API
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
            Real-time webhooks
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
            AI mapování polí
          </div>
        </div>
      </div>
    </section>
  )
}
