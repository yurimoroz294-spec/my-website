const TESTIMONIALS = [
  {
    quote: 'Ušetřili jsme 12 hodin týdně ručního zadávání objednávek ze Shoptetu do RAYNETu. Návratnost investice za první týden.',
    name: 'Martin Kovář',
    role: 'Majitel, SportDepot.cz',
    initials: 'MK',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    quote: 'Konečně se faktury z Pohody automaticky propisují do CRM. Naše účetní odpsala s pěti hvězdičkami.',
    name: 'Jana Horáčková',
    role: 'Operations Manager, ModaShop.cz',
    initials: 'JH',
    color: 'bg-green-100 text-green-700',
  },
  {
    quote: 'AI parsování PDF faktur funguje překvapivě přesně. IČO, DIČ, variabilní symbol — vše správně napoprvé.',
    name: 'Tomáš Blažek',
    role: 'CEO, TechDistrib.cz',
    initials: 'TB',
    color: 'bg-purple-100 text-purple-700',
  },
]

export function LandingTestimonials() {
  return (
    <section className="py-20 px-4 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Co říkají zákazníci</h2>
          <p className="text-gray-500 text-sm">České e-shopy, které přestaly manuálně zadávat data</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="h-4 w-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed mb-6 italic">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${t.color}`}>
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
