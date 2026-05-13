'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/dashboard',                    icon: '📊', label: 'Přehled' },
  { href: '/dashboard/invoices',           icon: '🧾', label: 'Faktury' },
  { href: '/dashboard/logs',               icon: '📋', label: 'Logy' },
  { href: '/dashboard/connections/email',  icon: '📧', label: 'E-mail' },
  { href: '/dashboard/connections/crm',    icon: '🔗', label: 'Účetnictví' },
  { href: '/dashboard/billing',            icon: '💳', label: 'Fakturace' },
  { href: '/dashboard/settings',           icon: '⚙️',  label: 'Nastavení' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-60 min-h-screen bg-slate-900 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800">
        <span className="text-xl font-bold text-white">
          Nex<span className="text-blue-400">AI</span>
        </span>
        <p className="text-xs text-slate-500 mt-0.5">Invoice Automation</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(item => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white',
              )}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-slate-800">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <span>🚪</span>
          Odhlásit se
        </button>
      </div>
    </aside>
  )
}
