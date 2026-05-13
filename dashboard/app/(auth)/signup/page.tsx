'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '', company: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('Heslo musí mít alespoň 8 znaků.')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { company_name: form.company } },
      })
      if (error) { setError(error.message); return }
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="text-4xl mb-4">📧</div>
          <h2 className="text-lg font-semibold text-gray-900">Zkontrolujte e-mail</h2>
          <p className="mt-2 text-sm text-gray-500">
            Odeslali jsme vám potvrzovací odkaz na <strong>{form.email}</strong>.
            Po potvrzení se můžete přihlásit.
          </p>
          <Link href="/login" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Zpět na přihlášení
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Vytvořit účet</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="company">Název firmy</Label>
            <Input
              id="company"
              required
              value={form.company}
              onChange={set('company')}
              placeholder="Vaše s.r.o."
            />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={set('email')}
              placeholder="vas@firma.cz"
            />
          </div>
          <div>
            <Label htmlFor="password">Heslo</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={set('password')}
              placeholder="min. 8 znaků"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Vytvořit účet zdarma
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Již máte účet?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">
            Přihlásit se
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
