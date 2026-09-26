import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { api, tokenStorage } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/Logo'
import { Button } from '../components/ui/Button'
import { Field, FormError, Input } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'

const MIN_PASSWORD_LENGTH = 8

function RecoveryLayout({ children }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <Link to="/inicio" aria-label="Conoce BikeTelemetry" className="mb-8 rounded-md focus-visible:outline-2 focus-visible:outline-brand-2">
        <Logo />
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 animate-rise-in sm:p-8">
        {children}
      </div>
      <Link to="/" className="mt-6 flex items-center gap-1.5 text-sm text-zinc-400 underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-zinc-100">
        <Icon name="arrowLeft" className="size-4" /> Volver a iniciar sesión
      </Link>
    </main>
  )
}

function Heading({ title, children }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">{title}</h2>
      <p className="mt-1.5 text-sm text-zinc-400">{children}</p>
    </div>
  )
}

// /recuperar: pide el email y envía el enlace. La respuesta es la misma exista o no la cuenta
export function ForgotPasswordPage() {
  const { state } = useLocation()
  const [email, setEmail] = useState(state?.email ?? '')
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } })
      setSentTo(email.trim())
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (sentTo) {
    return (
      <RecoveryLayout>
        <div className="flex flex-col gap-4">
          <Heading title="Revisa tu correo">
            Si <span className="text-zinc-100">{sentTo}</span> tiene cuenta, te hemos enviado un enlace para elegir una contraseña nueva. Caduca en 30 minutos.
          </Heading>
          <p className="text-sm text-zinc-400">¿No llega? Mira en la carpeta de spam o{' '}
            <button type="button" onClick={() => setSentTo('')} className="text-zinc-100 underline decoration-zinc-700 underline-offset-4 hover:decoration-zinc-400">
              pide otro enlace
            </button>.
          </p>
        </div>
      </RecoveryLayout>
    )
  }

  return (
    <RecoveryLayout>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <Heading title="Recupera tu contraseña">Te enviaremos un enlace para elegir una nueva.</Heading>
        <Field label="Email">
          {(id) => <Input id={id} type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />}
        </Field>
        <FormError>{error}</FormError>
        <Button type="submit" className="w-full" loading={submitting} disabled={!email.trim()}>Enviar enlace</Button>
      </form>
    </RecoveryLayout>
  )
}

// /restablecer#token=...: el enlace del correo. Elige la contraseña nueva y entra directamente
export function ResetPasswordPage() {
  const { setUser } = useAuth()
  // El token se lee una vez al montar y sale de la barra de direcciones y del historial
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token'))
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
    if (password !== confirm) return setError('Las contraseñas no coinciden')
    setSubmitting(true)
    try {
      const { user, token: session } = await api('/auth/reset-password', { method: 'POST', body: { token, password } })
      tokenStorage.set(session)
      window.history.replaceState(null, '', '/')
      setUser(user)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <RecoveryLayout>
        <div className="flex flex-col gap-4">
          <Heading title="Enlace incompleto">Abre el enlace tal cual llega en el correo o pide uno nuevo.</Heading>
          <Button as={Link} to="/recuperar" variant="secondary" className="w-full">Pedir otro enlace</Button>
        </div>
      </RecoveryLayout>
    )
  }

  return (
    <RecoveryLayout>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <Heading title="Elige una contraseña nueva">Al guardarla entrarás directamente en tu cuenta.</Heading>
        <div className="flex flex-col gap-4">
          <Field label="Contraseña nueva" hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres.`}>
            {(id) => <Input id={id} type="password" autoComplete="new-password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Field label="Repite la contraseña">
            {(id) => <Input id={id} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </Field>
        </div>
        <FormError>
          {error}
          {/caducado/.test(error) && <> <Link to="/recuperar" className="underline underline-offset-4">Pedir otro enlace</Link></>}
        </FormError>
        <Button type="submit" className="w-full" loading={submitting} disabled={!password || !confirm}>Guardar y entrar</Button>
      </form>
    </RecoveryLayout>
  )
}
