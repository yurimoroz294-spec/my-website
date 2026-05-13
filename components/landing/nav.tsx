'use client'

import Link from 'next/link'
import { Database } from 'lucide-react'

// Graceful fallback when Clerk is not configured
let SignedIn: React.FC<{ children: React.ReactNode }> = () => null
let SignedOut: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>
let UserButton: React.FC<{ afterSignOutUrl?: string }> = () => null

try {
  const clerk = require('@clerk/nextjs')
  SignedIn = clerk.SignedIn
  SignedOut = clerk.SignedOut
  UserButton = clerk.UserButton
} catch {}


export function LandingNav() {
  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-blue-700">
          <Database className="h-6 w-6" />
          CzechDataSync
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
          <Link href="#funkce" className="hover:text-blue-700 transition-colors">Funkce</Link>
          <Link href="#integrace" className="hover:text-blue-700 transition-colors">Integrace</Link>
          <Link href="#cenik" className="hover:text-blue-700 transition-colors">Ceník</Link>
          <Link href="#faq" className="hover:text-blue-700 transition-colors">FAQ</Link>
        </div>

        <div className="flex items-center gap-3">
          <SignedOut>
            <Link href="/sign-in" className="text-sm text-gray-600 hover:text-blue-700 transition-colors">
              Přihlásit se
            </Link>
            <Link
              href="/sign-up"
              className="text-sm bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors"
            >
              Začít zdarma
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/app"
              className="text-sm bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors"
            >
              Dashboard
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </div>
    </nav>
  )
}
