import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { squareImage } from '../lib/image'
import { Avatar } from './Avatar'
import { Spinner } from './ui/Spinner'

// Foto de perfil con sus acciones bajo `children` (nombre y email): pulsar la foto o
// «Cambiar foto» abre el selector de archivos
export function AvatarPicker({ children }) {
  const { user, setUser } = useAuth()
  const { toast } = useApp()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)

  async function run(request, message) {
    setBusy(true)
    try {
      const { user: updated } = await request()
      setUser(updated)
      toast(message, 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // para poder elegir otra vez el mismo archivo
    if (!file) return
    await run(async () => {
      const body = new FormData()
      body.append('file', await squareImage(file), 'avatar')
      return api('/auth/me/avatar', { method: 'PUT', body })
    }, 'Foto actualizada.')
  }

  const remove = () => run(() => api('/auth/me/avatar', { method: 'DELETE' }), 'Foto eliminada.')

  const link = 'rounded-sm text-xs text-zinc-400 underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand-2'
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label="Cambiar foto de perfil"
        className="relative shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-2">
        <Avatar user={user} size="size-16 text-xl" />
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-zinc-950/60">
            <Spinner className="size-5" />
          </span>
        )}
      </button>
      <input ref={input} type="file" accept="image/*" onChange={handleFile} hidden />
      <div className="min-w-0 flex-1">
        {children}
        <div className="mt-2 flex gap-4">
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className={link}>
            {user.avatarUrl ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {user.avatarUrl && <button type="button" onClick={remove} disabled={busy} className={link}>Quitar foto</button>}
        </div>
      </div>
    </div>
  )
}
