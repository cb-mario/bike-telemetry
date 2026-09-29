import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { connectStrava, disconnectStrava, getStravaStatus, syncStrava } from '../lib/strava'
import { useApiQuery } from '../lib/useApiQuery'
import { Button } from './ui/Button'

function timeAgo(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.round(hours / 24)} d`
}

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
      const d = result.duplicates
      const imported = n ? `${n === 1 ? '1 salida nueva importada' : `${n} salidas nuevas importadas`} desde Strava.` : 'Todo al día: no hay salidas nuevas en Strava.'
      // Salidas que ya estaban por otra vía (un GPX, otro servicio): se enlazan, no se duplican
      const linked = d ? ` ${d === 1 ? '1 ya estaba registrada' : `${d} ya estaban registradas`} y no se ha duplicado.` : ''
      // Historial largo: cada sincronización trae una parte para no agotar el límite de Strava
      const more = result.hasMore ? ' Quedan salidas antiguas: vuelve a sincronizar para seguir.' : ''
      toast(`${imported}${linked}${more}`, 'success')
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
          {' · '}
          <button type="button" onClick={handleDisconnect} className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300">
            Desconectar
          </button>
        </p>
      )}
    </div>
  )
}
