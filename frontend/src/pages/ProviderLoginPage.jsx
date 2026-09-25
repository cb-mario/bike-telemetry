import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/Logo'
import { FormError } from '../components/ui/Field'
import { Spinner } from '../components/ui/Spinner'

const PROVIDERS = { strava: 'Strava', google: 'Google' }

// Vuelta de "Continuar con Strava/Google" (/entrar/:provider#ticket=...): canjea el ticket por la sesión.
// Una cuenta nueva de Strava entra en Salidas, donde ya puede sincronizar; el resto, en el Resumen
export function ProviderLoginPage() {
  const { provider } = useParams()
  const name = PROVIDERS[provider] ?? 'tu cuenta'
  const { exchangeLoginTicket, setUser } = useAuth()
  // El ticket se lee una vez al montar; sin él no hay nada que canjear
  const [ticket] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('ticket'))
  const [error, setError] = useState(() => (ticket ? '' : `Falta el código de acceso de ${name}. Vuelve a intentarlo desde la pantalla de acceso.`))
  const started = useRef(false)

  useEffect(() => {
    // El ticket sale de la barra de direcciones y del historial cuanto antes
    window.history.replaceState(null, '', window.location.pathname)
    if (!ticket || started.current) return
    started.current = true
    exchangeLoginTicket(ticket)
      .then(({ user, created }) => {
        window.history.replaceState(null, '', created && provider === 'strava' ? '/salidas?strava=connected' : '/')
        setUser(user)
      })
      .catch((err) => setError(err.message))
  }, [ticket, provider, exchangeLoginTicket, setUser])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4">
      <Logo />
      {error ? (
        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          <FormError>{error}</FormError>
          <Link to="/" className="text-sm text-zinc-300 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-100">
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-zinc-400" aria-live="polite">
          <Spinner className="size-4" /> Entrando con {name}…
        </p>
      )}
    </main>
  )
}
