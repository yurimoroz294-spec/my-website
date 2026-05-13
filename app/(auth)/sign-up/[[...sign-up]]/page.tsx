import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Vytvořit účet zdarma</h1>
          <p className="text-gray-500 mt-2 text-sm">100 synců/měsíc bez platební karty</p>
        </div>
        <SignUp />
      </div>
    </div>
  )
}
