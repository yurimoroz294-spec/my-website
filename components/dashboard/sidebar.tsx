'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Database, LayoutDashboard, Plug, RefreshCw, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

const UserButton = dynamic(
  () => import('@clerk/nextjs').then(m => ({ default: m.UserButton })),
  { ssr: false, loading: () => <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" /> },
)

const NAV = [
  { href: '/app',              label: 'Přehled',      icon: LayoutDashboard },
  { href: '/app/connections',  label: 'Propojení',    icon: Plug },
  { href: '/app/sync',         label: 'Synchronizace', icon: RefreshCw },
  { href: '/app/billing',      label: 'Předplatné',   icon: CreditCard },
]

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 bg-white border-r border-gray-100 flex flex-col h-full">
      <div className="p-5 border-b border-gray-100">
        <Link href="/app" className="flex items-center gap-2.5 font-bold text-blue-700">
          <Database className="h-5 w-5" />
          CzechDataSync
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/app' ? pathname === '/app' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-100 flex items-center gap-3">
        <UserButton afterSignOutUrl="/" />
        <div className="text-xs text-gray-500">Nastavení účtu</div>
      </div>
    </aside>
  )
}
