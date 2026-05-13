import { DashboardSidebar } from '@/components/dashboard/sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <DashboardSidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
