import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'latin-ext'] })

export const metadata: Metadata = {
  title: 'CzechDataSync — Automatizujte faktury a objednávky',
  description: 'Propojte RAYNET CRM, Pohoda, Shoptet a Packeta bez kódu. Automatizujte faktury a objednávky za 5 minut.',
  keywords: 'RAYNET CRM integrace, Shoptet API, Pohoda synchronizace, Packeta automatizace, český e-shop automatizace',
  authors: [{ name: 'CzechDataSync' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://czechdatasync.cz'),
  openGraph: {
    type: 'website',
    locale: 'cs_CZ',
    title: 'CzechDataSync — Automatizujte faktury a objednávky',
    description: 'No-code konektor pro české e-shopy. Shoptet → RAYNET, Pohoda → CRM, Packeta tracking.',
    siteName: 'CzechDataSync',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="cs">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  )
}
