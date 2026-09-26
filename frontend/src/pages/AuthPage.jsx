import { useState } from 'react'
import { Link } from 'react-router'
import { SocialLogin } from '../components/auth/SocialLogin'
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
        <div className="flex flex-col gap-2">
          <Field label="Contraseña">
            {(id) => <Input id={id} type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Link to="/recuperar" state={{ email }} className="self-end rounded-sm text-[13px] text-zinc-400 underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-brand-2">
            ¿Has olvidado la contraseña?
          </Link>
        </div>
      </div>
      <FormError>{error}</FormError>
      <Button type="submit" className="w-full" loading={submitting}>Entrar</Button>
    </form>
  )
}

export function AuthPage({ initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode)

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <AuthHero />
      <div className="flex flex-col items-center justify-center px-4 py-12">
        <Link to="/inicio" aria-label="Conoce BikeTelemetry" className="mb-8 rounded-md focus-visible:outline-2 focus-visible:outline-brand-2 lg:hidden">
          <Logo />
        </Link>
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_24px_48px_-24px_rgb(0_0_0/0.6)] animate-rise-in sm:p-8">
          <div className="mb-6">
            <SegmentedControl label="Modo" options={MODES} value={mode} onChange={setMode} />
          </div>
          <div className="mb-6">
            <SocialLogin />
          </div>
          {mode === 'login' ? <LoginForm /> : <RegisterSteps />}
        </div>
        <Link to="/inicio" className="mt-6 text-sm text-zinc-400 underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-zinc-100">
          ¿Qué es BikeTelemetry?
        </Link>
      </div>
    </main>
  )
}
