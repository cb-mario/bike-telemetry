import { useCallback, useState } from 'react'
import { api } from './api'
import { useApp } from '../context/AppContext'
import { useApiQuery } from './useApiQuery'

// Servicios de los que llegan salidas, con el estado de la conexión del usuario:
// [{ provider, name, auth, configured, connected, account, lastSyncAt }]
export const getConnections = () => api('/connections')
export const disconnectConnection = (provider) => api(`/connections/${provider}`, { method: 'DELETE' })
export const connectConnection = (provider, body) => api(`/connections/${provider}/connect`, { method: 'POST', body })
const syncOnce = (provider) => api(`/connections/${provider}/sync`, { method: 'POST' })

// Cada llamada trae una parte (límite de peticiones o de tiempo del servidor) y avisa con hasMore;
// el historial largo se completa en varias tandas
const MAX_ROUNDS = 30

// Sincroniza un servicio hasta traerlo todo. `onProgress` recibe los importados acumulados
export async function syncConnection(provider, onProgress) {
  const total = { imported: 0, duplicates: 0 }
  let result
  for (let round = 0; round < MAX_ROUNDS; round++) {
    result = await syncOnce(provider)
    total.imported += result.imported
    total.duplicates += result.duplicates ?? 0
    onProgress?.(total.imported)
    if (!result.hasMore) break
  }
  return { ...total, hasMore: result.hasMore, lastSyncAt: result.lastSyncAt }
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// Resumen de una sincronización (de uno o varios servicios) para el aviso
export function syncMessage({ imported, duplicates, hasMore }, from = '') {
  const main = imported
    ? `${plural(imported, 'salida nueva importada', 'salidas nuevas importadas')}${from && ` de ${from}`}.`
    : `Todo al día: no hay salidas nuevas${from && ` en ${from}`}.`
  // Ya estaban por otra vía (un GPX, otro servicio): se enlazan, no se duplican
  const linked = duplicates ? ` ${duplicates === 1 ? '1 ya estaba registrada' : `${duplicates} ya estaban registradas`} y no se ha duplicado.` : ''
  const more = hasMore ? ' Quedan salidas antiguas: vuelve a sincronizar para seguir.' : ''
  return `${main}${linked}${more}`
}

// Estado de las conexiones y acciones sobre ellas. Solo aparecen los servicios configurados
export function useConnections() {
  const { refresh, toast, refreshKey } = useApp()
  const { data, error, setData } = useApiQuery(getConnections, [refreshKey])
  const [syncing, setSyncing] = useState(null) // { provider, imported } mientras sincroniza
  const connections = error ? [] : data?.filter((c) => c.configured)

  const patch = useCallback((provider, changes) => {
    setData((list) => list?.map((c) => (c.provider === provider ? { ...c, ...changes } : c)))
  }, [setData])

  // Sincroniza los servicios indicados uno tras otro y resume el resultado en un aviso
  async function sync(list) {
    const total = { imported: 0, duplicates: 0, hasMore: false }
    try {
      for (const c of list) {
        setSyncing({ provider: c.provider, name: c.name, imported: total.imported })
        const result = await syncConnection(c.provider, (n) => setSyncing({ provider: c.provider, name: c.name, imported: total.imported + n }))
        total.imported += result.imported
        total.duplicates += result.duplicates
        total.hasMore ||= result.hasMore
        patch(c.provider, { lastSyncAt: result.lastSyncAt })
      }
      toast(syncMessage(total, list.length === 1 ? list[0].name : ''), 'success')
    } catch (err) {
      // Lo importado antes del fallo se conserva
      toast(total.imported ? `${syncMessage(total)} ${err.message}` : err.message, 'error')
      // 409: la conexión ya no vale (acceso revocado o sesión caducada); hay que volver a conectar
      if (err.status === 409) refresh()
    } finally {
      setSyncing(null)
      if (total.imported || total.duplicates) refresh()
    }
  }

  // OAuth: navega al servicio, que vuelve a la app. Con credenciales, deja la conexión hecha
  // (si fallan, lanza el error para mostrarlo en el formulario)
  async function connect(connection, body) {
    const result = await connectConnection(connection.provider, body)
    if (result.url) return window.location.assign(result.url)
    patch(connection.provider, { connected: true, ...result })
  }

  async function disconnect(connection) {
    try {
      await disconnectConnection(connection.provider)
      patch(connection.provider, { connected: false, account: null, lastSyncAt: null })
      toast(`${connection.name} desconectado. Tus salidas importadas se conservan.`, 'info')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return { connections, syncing, sync, connect, disconnect }
}
