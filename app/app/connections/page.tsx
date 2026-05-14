import { getAuthUserId } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { ConnectionCard } from '@/components/dashboard/connection-card'

const PLATFORMS = [
  {
    id: 'RAYNET' as const,
    name: 'RAYNET CRM',
    desc: 'Propojte váš RAYNET účet. Potřebujete API klíč z nastavení RAYNETu.',
    emoji: '📊',
    color: 'border-orange-200 bg-orange-50',
    fields: [
      { key: 'instanceName', label: 'Název instance', placeholder: 'mojefirma', type: 'text' },
      { key: 'username', label: 'Uživatelské jméno', placeholder: 'jan.novak@firma.cz', type: 'text' },
      { key: 'apiKey', label: 'API klíč', placeholder: 'xxxxxxxxxxxxxxxx', type: 'password' },
    ],
    docsUrl: 'https://app.raynetcrm.com/api',
  },
  {
    id: 'SHOPTET' as const,
    name: 'Shoptet',
    desc: 'Připojte váš Shoptet e-shop. API klíč najdete v Administraci → Doplňky → API.',
    emoji: '🛒',
    color: 'border-green-200 bg-green-50',
    fields: [
      { key: 'eshopId', label: 'ID e-shopu', placeholder: '12345', type: 'text' },
      { key: 'apiKey', label: 'API klíč', placeholder: 'xxxxxxxxxxxxxxxx', type: 'password' },
    ],
    docsUrl: 'https://shoptet.docs.apiary.io',
  },
  {
    id: 'POHODA' as const,
    name: 'Pohoda (Stormware)',
    desc: 'Připojte Pohodu přes XML API. Vyžaduje Pohoda SQL nebo E1 s povolenou XML komunikací.',
    emoji: '📄',
    color: 'border-blue-200 bg-blue-50',
    fields: [
      { key: 'url', label: 'URL Pohody', placeholder: 'http://192.168.1.10:5336', type: 'text' },
      { key: 'username', label: 'Uživatel', placeholder: 'admin', type: 'text' },
      { key: 'password', label: 'Heslo', placeholder: '••••••••', type: 'password' },
      { key: 'ico', label: 'IČO', placeholder: '12345678', type: 'text' },
    ],
    docsUrl: 'https://www.stormware.cz/pohoda/xml/',
  },
  {
    id: 'PACKETA' as const,
    name: 'Packeta (Zásilkovna)',
    desc: 'Propojte Zásilkovnu pro sledování zásilek. API klíč najdete v Klientské sekci.',
    emoji: '📦',
    color: 'border-purple-200 bg-purple-50',
    fields: [
      { key: 'apiKey', label: 'API klíč', placeholder: 'xxxxxxxxxxxxxxxx', type: 'password' },
      { key: 'apiPassword', label: 'API heslo', placeholder: '••••••••', type: 'password' },
    ],
    docsUrl: 'https://docs.packeta.com/api',
  },
  {
    id: 'AIRTABLE' as const,
    name: 'Airtable',
    desc: 'Propojte Airtable pro projektové řízení, CRM kontakty, inventář a plánování. Dostupné v plánech Pro a Business.',
    emoji: '📋',
    color: 'border-yellow-200 bg-yellow-50',
    badge: 'Pro',
    fields: [
      { key: 'accessToken', label: 'Personal Access Token', placeholder: 'pat...', type: 'password' },
      { key: 'baseId', label: 'Base ID', placeholder: 'app...', type: 'text' },
    ],
    docsUrl: 'https://airtable.com/developers/web/api/introduction',
  },
  {
    id: 'MONEY_S3' as const,
    name: 'Money S3 (Solitea)',
    desc: 'Připojte Money S3 přes mServer XML API. Vyžaduje povolenou XML komunikaci v Money S3.',
    emoji: '💸',
    color: 'border-rose-200 bg-rose-50',
    fields: [
      { key: 'url', label: 'URL mServeru', placeholder: 'http://192.168.1.10:8090', type: 'text' },
      { key: 'username', label: 'Uživatel', placeholder: 'admin', type: 'text' },
      { key: 'password', label: 'Heslo', placeholder: '••••••••', type: 'password' },
      { key: 'ico', label: 'IČO', placeholder: '12345678', type: 'text' },
    ],
    docsUrl: 'https://money.cz/dokumentace/',
  },
  {
    id: 'IDOKLAD' as const,
    name: 'iDoklad (Solitea)',
    desc: 'Cloudové fakturace pro malé a střední firmy. Použijte OAuth aplikaci v iDoklad → Vývojáři → API.',
    emoji: '🧾',
    color: 'border-sky-200 bg-sky-50',
    fields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'xxxxx', type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: '••••••••', type: 'password' },
    ],
    docsUrl: 'https://api.idoklad.cz/Help',
  },
  {
    id: 'FAKTUROID' as const,
    name: 'Fakturoid',
    desc: 'Populární cloud fakturace pro freelancery a IT firmy. API klíč najdete v Nastavení → API.',
    emoji: '🟢',
    color: 'border-emerald-200 bg-emerald-50',
    fields: [
      { key: 'slug', label: 'Účet (slug)', placeholder: 'mojefirma', type: 'text' },
      { key: 'email', label: 'Email', placeholder: 'jan.novak@firma.cz', type: 'text' },
      { key: 'apiKey', label: 'API klíč', placeholder: 'xxxxxxxxxxxxxxxx', type: 'password' },
    ],
    docsUrl: 'https://fakturoid.docs.apiary.io',
  },
  {
    id: 'ABRA_FLEXI' as const,
    name: 'ABRA Flexi',
    desc: 'ERP a účetnictví pro střední firmy. REST API přes základní HTTP autentizaci.',
    emoji: '🏢',
    color: 'border-indigo-200 bg-indigo-50',
    fields: [
      { key: 'url', label: 'URL serveru', placeholder: 'https://demo.flexibee.eu', type: 'text' },
      { key: 'company', label: 'Kód firmy', placeholder: 'demo', type: 'text' },
      { key: 'username', label: 'Uživatel', placeholder: 'winstrom', type: 'text' },
      { key: 'password', label: 'Heslo', placeholder: '••••••••', type: 'password' },
    ],
    docsUrl: 'https://www.flexibee.eu/api/dokumentace/',
  },
  {
    id: 'EMAIL_IMAP' as const,
    name: 'E-mailová schránka (IMAP)',
    desc: 'Propojte emailovou schránku, kam chodí faktury. Systém ji automaticky kontroluje a zpracovává přílohy. Funguje s Gmail, Seznam, Outlook i firemní poštou.',
    emoji: '📬',
    color: 'border-teal-200 bg-teal-50',
    badge: 'Pro',
    fields: [
      { key: 'host', label: 'IMAP server', placeholder: 'imap.gmail.com', type: 'text' },
      { key: 'port', label: 'Port', placeholder: '993', type: 'text' },
      { key: 'user', label: 'E-mail', placeholder: 'faktury@firma.cz', type: 'text' },
      { key: 'password', label: 'Heslo / App heslo', placeholder: '••••••••', type: 'password' },
      { key: 'folder', label: 'Složka (volitelné)', placeholder: 'INBOX', type: 'text' },
    ],
  },
]

export default async function ConnectionsPage() {
  const userId = await getAuthUserId()
  if (!userId) redirect('/sign-in')

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect('/sign-in')

  const connections = await prisma.connection.findMany({ where: { userId: user.id } })
  const connectedMap = new Map(connections.map(c => [c.platform, c]))

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Propojení platforem</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Připojte platformy, které chcete synchronizovat. API klíče jsou šifrované AES-256.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {PLATFORMS.map(platform => (
          <ConnectionCard
            key={platform.id}
            platform={platform}
            existing={connectedMap.get(platform.id) ?? null}
            userId={user.id}
          />
        ))}
      </div>
    </div>
  )
}
