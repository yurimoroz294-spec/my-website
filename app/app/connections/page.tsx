import { auth } from '@clerk/nextjs/server'
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
]

export default async function ConnectionsPage() {
  const { userId } = auth()
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
