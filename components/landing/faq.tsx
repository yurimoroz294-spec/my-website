'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FAQ_ITEMS = [
  {
    q: 'Potřebuji technické znalosti pro nastavení?',
    a: 'Ne. Stačí zadat API klíče ze svých platforem, vybrat šablonu (např. Shoptet → RAYNET) a kliknout na spustit. Průvodce nastavením vás provede každým krokem.',
  },
  {
    q: 'Kde jsou moje data uložena?',
    a: 'Veškerá data jsou uložena v EU (Frankfurt, Německo). API klíče jsou šifrované AES-256 a nikdy se nezobrazují v čistém textu. Jsme plně GDPR-compliant.',
  },
  {
    q: 'Funguje to s mojí verzí Pohody?',
    a: 'Podporujeme Pohoda XML API (verze 2.0), které je dostupné v Pohoda SQL a Pohoda E1 od verze 2015. Pohoda Start není podporována.',
  },
  {
    q: 'Co se stane, když sync selže?',
    a: 'Zobrazí se detailní chybová hláška v logu. Sync se automaticky opakuje 3× s exponenciálním zpožděním. Dostanete emailové upozornění.',
  },
  {
    q: 'Jak se počítá 100 synců v bezplatném plánu?',
    a: 'Jeden "sync" = jedno spuštění synchronizačního pravidla (bez ohledu na počet zpracovaných záznamů). 100 synců/měsíc = přibližně 3 automatické syncy denně.',
  },
  {
    q: 'Mohu zrušit kdykoli?',
    a: 'Ano. Bez závazků, bez poplatků za zrušení. Zrušíte-li uprostřed měsíce, přístup k Pro funkcím máte do konce zaplaceného období.',
  },
]

export function LandingFaq() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="faq" className="py-20 px-4 bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Časté otázky</h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium text-gray-900 pr-4">{item.q}</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
