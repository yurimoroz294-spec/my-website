'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Něco se pokazilo</h2>
        <p className="text-sm text-gray-500 mb-4">{error.message}</p>
        <button onClick={reset} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800">
          Zkusit znovu
        </button>
      </div>
    </div>
  )
}
