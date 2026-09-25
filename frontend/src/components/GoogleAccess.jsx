import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useApp } from '../context/AppContext'
import { getGoogleStatus, GOOGLE_LINK_RESULT, linkGoogle, unlinkGoogle } from '../lib/google'
import { Button } from './ui/Button'

// Vincular o desvincular Google como forma de entrar (tarjeta del perfil)
export function GoogleAccess() {
  const { toast } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getGoogleStatus().then(setStatus).catch(() => setStatus(null))
  }, [])

  // Resultado de la vuelta desde Google (?google=linked|taken|…), mostrado una sola vez
  const handled = useRef(null)
  useEffect(() => {
    const result = searchParams.get('google')
    if (!result || handled.current === result) return
    handled.current = result
    const [message, tone] = GOOGLE_LINK_RESULT[result] ?? GOOGLE_LINK_RESULT.error
    toast(message, tone)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams, toast])

  async function handleLink() {
    setBusy(true)
    try {
      await linkGoogle() // navega a Google
    } catch (err) {
      toast(err.status === 503 ? 'La vinculación con Google no está disponible ahora mismo.' : err.message, 'error')
      setBusy(false)
    }
  }

  async function handleUnlink() {
    setBusy(true)
    try {
      await unlinkGoogle()
      setStatus((s) => ({ ...s, linked: false }))
      toast('Google desvinculado. Ya no podrás entrar con esa cuenta.', 'info')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!status) return null
  if (!status.linked) {
    return <Button variant="secondary" onClick={handleLink} loading={busy}>Vincular cuenta de Google</Button>
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <p className="text-sm text-zinc-200">Puedes entrar con tu cuenta de Google.</p>
      {status.canUnlink ? (
        <button type="button" onClick={handleUnlink} disabled={busy}
          className="text-[11px] text-zinc-500 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300 disabled:opacity-50">
          Desvincular
        </button>
      ) : (
        <p className="text-[11px] text-zinc-500">Es tu forma de entrar, así que no se puede desvincular.</p>
      )}
    </div>
  )
}
