import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-6xl font-extrabold text-gray-200 mb-4">404</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Stránka nenalezena</h2>
        <p className="text-sm text-gray-500 mb-6">Tato stránka neexistuje.</p>
        <Link href="/" className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800">
          Zpět na úvod
        </Link>
      </div>
    </div>
  )
}
