import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Přihlásit se do CzechDataSync</h1>
          <p className="text-gray-500 mt-2 text-sm">Propojte Shoptet, RAYNET, Pohoda a Packeta</p>
        </div>
        <SignIn />
      </div>
    </div>
  )
}
