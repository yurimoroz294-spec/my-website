import Link from 'next/link'
import { Database } from 'lucide-react'

export function LandingFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-lg mb-3">
              <Database className="h-5 w-5" />
              CzechDataSync
            </div>
            <p className="text-sm leading-relaxed">
              No-code API konektor pro české B2B e-commerce. Propojujeme RAYNET, Pohoda, Shoptet a Packeta.
            </p>
          </div>

          <div>
            <div className="text-white font-medium mb-3 text-sm">Produkt</div>
            <ul className="space-y-2 text-sm">
              <li><Link href="#funkce" className="hover:text-white transition-colors">Funkce</Link></li>
              <li><Link href="#integrace" className="hover:text-white transition-colors">Integrace</Link></li>
              <li><Link href="#cenik" className="hover:text-white transition-colors">Ceník</Link></li>
              <li><Link href="/changelog" className="hover:text-white transition-colors">Changelog</Link></li>
            </ul>
          </div>

          <div>
            <div className="text-white font-medium mb-3 text-sm">Podpora</div>
            <ul className="space-y-2 text-sm">
              <li><Link href="/docs" className="hover:text-white transition-colors">Dokumentace</Link></li>
              <li><Link href="#faq" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><a href="mailto:info@czechdatasync.cz" className="hover:text-white transition-colors">info@czechdatasync.cz</a></li>
            </ul>
          </div>

          <div>
            <div className="text-white font-medium mb-3 text-sm">Právní</div>
            <ul className="space-y-2 text-sm">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Ochrana osobních údajů</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Obchodní podmínky</Link></li>
              <li><Link href="/gdpr" className="hover:text-white transition-colors">GDPR</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          <div>
            © {new Date().getFullYear()} CzechDataSync s.r.o. · Všechna práva vyhrazena
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              Všechny systémy fungují
            </span>
            <span>🇨🇿 Vyrobeno v Česku</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
