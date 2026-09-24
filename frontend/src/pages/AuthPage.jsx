import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Field, FormError, Input } from '../components/ui/Field'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Logo } from '../components/Logo'
import { AuthHero } from '../components/auth/AuthHero'
import { RegisterSteps } from '../components/auth/RegisterSteps'

const MODES = [
  { value: 'login', label: 'Iniciar sesión' },
  { value: 'register', label: 'Crear cuenta' },
]

function LoginForm() {
  const { authenticate } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await authenticate('login', email, password)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 animate-rise-in" noValidate>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">Bienvenido de nuevo</h2>
        <p className="mt-1.5 text-sm text-zinc-400">Entra para ver tus métricas y salidas.</p>
      </div>
      <div className="flex flex-col gap-4">
        <Field label="Email">
          {(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />}
        </Field>
        <Field label="Contraseña">
          {(id) => <Input id={id} type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
      </div>
      <FormError>{error}</FormError>
      <Button type="submit" className="w-full" loading={submitting}>Entrar</Button>
    </form>
  )
}

export function AuthPage() {
  const [mode, setMode] = useState('login')

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <AuthHero />
      <div className="flex flex-col items-center justify-center px-4 py-12">
        <Logo className="mb-8 lg:hidden" />
        <div className="w-full max-w-md rounded-3xl border border-zinc-700/50 bg-zinc-900/70 p-6 shadow-[0_30px_80px_-30px_rgb(37_99_235/0.45),inset_0_1px_0_0_rgb(255_255_255/0.05)] backdrop-blur-xl animate-rise-in sm:p-8">
          <div className="mb-8">
            <SegmentedControl label="Modo" options={MODES} value={mode} onChange={setMode} />
          </div>
          {mode === 'login' ? <LoginForm /> : <RegisterSteps />}
        </div>
      </div>
    </main>
  )
}
