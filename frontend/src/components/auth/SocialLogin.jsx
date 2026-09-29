import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { FormError } from '../ui/Field'
import { loginWithGoogle, GOOGLE_LOGIN_ERROR } from '../../lib/google'
import { useProviders } from '../../lib/providers'

// Logotipo "G" oficial de Google (Google Identity branding guidelines: no se modifica ni recolorea)
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

const UNAVAILABLE = 'El acceso con Google no está disponible ahora mismo. Entra con tu email.'

// "Continuar con Google": entra en la cuenta vinculada o crea una nueva.
// Solo aparece si Google está configurado en el servidor
export function SocialLogin() {
  const providers = useProviders()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(() => {
    const google = searchParams.get('google_login')
    return google ? GOOGLE_LOGIN_ERROR[google] ?? GOOGLE_LOGIN_ERROR.error : ''
  })

  async function start() {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle() // navega a Google
    } catch (err) {
      // 503: el servidor no tiene credenciales de Google; no se muestran detalles técnicos
      setError(err.status === 503 ? UNAVAILABLE : err.message)
      setLoading(false)
    }
  }

  if (!providers?.google) return <FormError>{error}</FormError>

  return (
    <div className="flex flex-col gap-3">
      {/* Botón de Google con los colores de su guía para fondo oscuro */}
      <button type="button" onClick={start} disabled={loading} aria-busy={loading || undefined}
        className="inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-[#8e918f] bg-[#131314] text-sm font-medium text-[#e3e3e3]
          transition-colors duration-150 hover:bg-[#1f1f20] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-2
          disabled:opacity-60">
        <GoogleG />
        {loading ? 'Abriendo Google…' : 'Continuar con Google'}
      </button>
      <FormError>{error}</FormError>
      <div className="flex items-center gap-3 text-xs text-zinc-500" aria-hidden>
        <span className="h-px flex-1 bg-zinc-800" />o con tu email<span className="h-px flex-1 bg-zinc-800" />
      </div>
    </div>
  )
}
