export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="text-2xl font-bold text-white">
            Nex<span className="text-blue-400">AI</span>
          </a>
          <p className="mt-1 text-sm text-slate-400">Invoice Automation Dashboard</p>
        </div>
        {children}
      </div>
    </div>
  )
}
