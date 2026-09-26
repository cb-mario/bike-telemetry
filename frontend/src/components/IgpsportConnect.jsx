import { useState } from 'react'
import { Button } from './ui/Button'
import { Field, FormError, Input } from './ui/Field'
import { Spinner } from './ui/Spinner'
import { formatNumber, timeAgo } from '../lib/format'
import { useIgpsport } from '../lib/igpsport'

const plural = (n, one, many) => `${formatNumber(n)} ${n === 1 ? one : many}`

// Panel de la cuenta de iGPSPORT: conectar con email y contraseña, sincronizar y desconectar.
// Trae los .fit originales de su nube, sin cable ni exportaciones a mano
export function IgpsportPanel() {
  const { status, syncing, progress, sync, connect, disconnect } = useIgpsport()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)

  // Sin clave de cifrado en el servidor no se ofrece
  if (!status || !status.configured) return null

  async function handleConnect(e) {
    e.preventDefault()
    setError('')
    setConnecting(true)
    try {
      await connect(email, password)
      setPassword('')
      await sync() // primera vez: se trae todo el historial
    } catch (err) {
      setError(err.message)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-zinc-100">Cuenta de iGPSPORT</h3>
          <p className="mt-0.5 text-sm text-zinc-400">
            {status.connected
              ? <>Conectada como <span className="text-zinc-200">{status.account}</span>
                {' · '}{status.lastSyncAt ? `sincronizada ${timeAgo(status.lastSyncAt)}` : 'aún sin sincronizar'}</>
              : 'Trae todas tus salidas de la app de iGPSPORT, sin cable.'}
          </p>
        </div>
        {status.connected && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={disconnect} disabled={syncing}>Desconectar</Button>
            <Button size="sm" onClick={sync} loading={syncing}>Sincronizar</Button>
          </div>
        )}
      </div>

      {syncing && (
        <p className="mt-4 flex items-center gap-2 text-sm text-zinc-300" aria-live="polite">
          <Spinner className="size-4" />
          {progress.imported
            ? `${plural(progress.imported, 'salida importada', 'salidas importadas')}… (el historial largo tarda unos minutos)`
            : 'Buscando salidas en iGPSPORT…'}
        </p>
      )}

      {!status.connected && (
        <form onSubmit={handleConnect} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Email de iGPSPORT">
            {(id) => <Input id={id} type="email" autoComplete="off" required value={email}
              onChange={(e) => setEmail(e.target.value)} disabled={connecting} />}
          </Field>
          <Field label="Contraseña">
            {(id) => <Input id={id} type="password" autoComplete="off" required value={password}
              onChange={(e) => setPassword(e.target.value)} disabled={connecting} />}
          </Field>
          <Button type="submit" loading={connecting} disabled={!email || !password}>Conectar</Button>
          <p className="text-xs text-zinc-500 sm:col-span-3">
            La contraseña solo se usa para iniciar sesión en iGPSPORT; no se guarda. Es la conexión que usa su web,
            no una integración oficial: si iGPSPORT la cambia, puede dejar de funcionar.
          </p>
        </form>
      )}
      {error && <div className="mt-3"><FormError>{error}</FormError></div>}
    </section>
  )
}

// Botón compacto para la cabecera de Salidas; solo aparece con la cuenta ya conectada
export function IgpsportSyncButton() {
  const { status, syncing, sync } = useIgpsport()
  if (!status?.connected) return null
  return (
    <Button variant="secondary" onClick={sync} loading={syncing}>Sincronizar iGPSPORT</Button>
  )
}
