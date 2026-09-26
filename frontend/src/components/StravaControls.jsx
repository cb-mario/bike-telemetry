import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { connectStrava, disconnectStrava, getStravaStatus, syncStrava } from '../lib/strava'
import { useApiQuery } from '../lib/useApiQuery'
import { Button } from './ui/Button'
import { timeAgo } from '../lib/format'

// Botón "Conectar con Strava" o "Sincronizar con Strava" según el estado de la cuenta
export function StravaControls() {
  const { refresh, toast, refreshKey } = useApp()
  const { data, error, setData: setStatus } = useApiQuery(getStravaStatus, [refreshKey])
  const status = error ? null : data ?? null
  const [busy, setBusy] = useState(false)

  async function handleConnect() {
    setBusy(true)
    try {
      await connectStrava() // navega a Strava
    } catch (err) {
      toast(err.message, 'error')
      setBusy(false)
    }
  }

  async function handleSync() {
    setBusy(true)
    try {
      const result = await syncStrava()
      const n = result.imported
      const imported = n ? `${n === 1 ? '1 salida nueva importada' : `${n} salidas nuevas importadas`} desde Strava.` : 'Todo al día: no hay salidas nuevas en Strava.'
      // Historial largo: cada sincronización trae una parte para no agotar el límite de Strava
      toast(result.hasMore ? `${imported} Quedan salidas antiguas: vuelve a sincronizar para seguir.` : imported, 'success')
      setStatus((s) => ({ ...s, lastSyncAt: result.lastSyncAt }))
      if (n) refresh()
    } catch (err) {
      toast(err.message, 'error')
      if (err.status === 409) setStatus((s) => ({ ...s, connected: false }))
    } finally {
      setBusy(false)
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectStrava()
      setStatus((s) => ({ ...s, connected: false, lastSyncAt: null }))
      toast('Strava desconectado. Tus salidas importadas se conservan.', 'info')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  // Sin credenciales de Strava en el servidor no se ofrece nada
  if (status && !status.configured) return null

  const connected = status?.connected
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="strava" onClick={connected ? handleSync : handleConnect} loading={busy}>
        {connected ? 'Sincronizar con Strava' : 'Conectar con Strava'}
      </Button>
      {connected && (
        <p className="text-[11px] text-zinc-500">
          {status.lastSyncAt ? `Sincronizado ${timeAgo(status.lastSyncAt)}` : 'Aún sin sincronizar'}
          {/* Una cuenta creada con Strava no puede desconectarlo: es su forma de entrar */}
          {status.canDisconnect && (
            <>
              {' · '}
              <button type="button" onClick={handleDisconnect} className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300">
                Desconectar
              </button>
            </>
          )}
        </p>
      )}
    </div>
  )
}
