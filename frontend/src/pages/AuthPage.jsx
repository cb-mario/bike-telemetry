import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Field, FormError, Input } from '../components/ui/Field'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Logo } from '../components/Logo'

const MODES = [
  { value: 'login', label: 'Iniciar sesión' },
  { value: 'register', label: 'Crear cuenta' },
]

export function AuthPage() {
  const { authenticate } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isRegister = mode === 'register'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await authenticate(mode, email, password)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <Logo className="mb-8" />

      <div className="w-full max-w-sm rounded-xl border border-zinc-800 p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">
          {isRegister ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          {isRegister
            ? 'Registra tus salidas y sigue tu evolución.'
            : 'Entra para ver tus métricas y salidas.'}
        </p>

        <div className="mt-6">
          <SegmentedControl
            label="Modo"
            options={MODES}
            value={mode}
            onChange={(value) => {
              setMode(value)
              setError('')
            }}
          />
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          <Field label="Email">
            {(id) => (
              <Input id={id} type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
            )}
          </Field>
          <Field label="Contraseña" hint={isRegister ? 'Mínimo 8 caracteres.' : undefined}>
            {(id) => (
              <Input id={id} type="password" required minLength={isRegister ? 8 : undefined}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
          </Field>

          <FormError>{error}</FormError>

          <Button type="submit" className="mt-2 w-full" disabled={submitting}>
            {submitting ? 'Un momento…' : isRegister ? 'Crear cuenta' : 'Entrar'}
          </Button>
        </form>
      </div>
    </main>
  )
}
