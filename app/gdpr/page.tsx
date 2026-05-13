export default function GdprPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Zásady ochrany osobních údajů (GDPR)</h1>

      <div className="prose prose-gray max-w-none space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">1. Správce osobních údajů</h2>
          <p>CzechDataSync s.r.o., IČO: [doplnit], sídlo: Praha, Česká republika.<br />
          Kontakt: gdpr@czechdatasync.cz</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">2. Jaká data zpracováváme</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Registrační údaje: e-mail, jméno, IČO/DIČ (volitelné)</li>
            <li>Přihlašovací záznamy a logy přístupu</li>
            <li>API klíče třetích stran (šifrované AES-256, nikdy v čistém textu)</li>
            <li>Metadata synchronizací (počty záznamů, časy spuštění, chyby)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">3. Kde jsou data uložena</h2>
          <p>Veškerá data jsou uložena v datových centrech v EU (Frankfurt, Německo, Vercel/AWS eu-central-1).
          Žádná data nepřenášíme mimo EHP bez vašeho souhlasu.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">4. Vaše práva</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Právo na přístup k vašim datům</li>
            <li>Právo na opravu a výmaz dat</li>
            <li>Právo na přenositelnost dat</li>
            <li>Právo podat stížnost u ÚOOÚ (uoou.cz)</li>
          </ul>
          <p className="mt-2">Žádost o uplatnění práv zasílejte na: gdpr@czechdatasync.cz</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">5. Bezpečnost</h2>
          <p>API klíče jsou šifrované pomocí AES-256-GCM. Připojení probíhá výhradně přes HTTPS/TLS 1.3.
          Pravidelně provádíme bezpečnostní audity.</p>
        </section>
      </div>

      <div className="mt-10 text-xs text-gray-400">
        Poslední aktualizace: {new Date().toLocaleDateString('cs-CZ')}
      </div>
    </div>
  )
}
