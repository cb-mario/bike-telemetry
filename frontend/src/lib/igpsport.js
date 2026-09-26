import { useState } from 'react'
import { api } from './api'
import { useApp } from '../context/AppContext'
import { useApiQuery } from './useApiQuery'

export const getIgpsportStatus = () => api('/igpsport/status')
export const connectIgpsport = (email, password) =>
  api('/igpsport/connect', { method: 'POST', body: { email, password } })
export const disconnectIgpsport = () => api('/igpsport/disconnect', { method: 'POST' })
const syncOnce = () => api('/igpsport/sync', { method: 'POST' })

// Cada llamada trabaja unos 40 s como mucho; el historial largo se trae en varias
const MAX_ROUNDS = 30

// Sincroniza hasta traer todo; `onProgress` recibe los totales acumulados tras cada tanda
export async function syncIgpsport(onProgress) {
  const total = { imported: 0, linked: 0, skipped: 0, errors: [] }
  let result
  for (let round = 0; round < MAX_ROUNDS; round++) {
    result = await syncOnce()
    total.imported += result.imported
    total.linked += result.linked
    total.skipped += result.skipped
    total.errors.push(...result.errors)
    onProgress?.({ ...total, hasMore: result.hasMore })
    if (!result.hasMore) break
  }
  return { ...total, alreadyImported: result.alreadyImported, lastSyncAt: result.lastSyncAt }
}

export function syncMessage({ imported, skipped }) {
  const main = imported
    ? `${imported === 1 ? '1 salida nueva importada' : `${imported} salidas nuevas importadas`} de iGPSPORT.`
    : 'Todo al día: no hay salidas nuevas en iGPSPORT.'
  return skipped ? `${main} ${skipped === 1 ? '1 no se pudo importar' : `${skipped} no se pudieron importar`}.` : main
}

// Estado de la cuenta de iGPSPORT y acciones, compartido por el panel y el botón de Salidas
export function useIgpsport() {
  const { refresh, toast, refreshKey } = useApp()
  const { data, error, setData: setStatus } = useApiQuery(getIgpsportStatus, [refreshKey])
  const [progress, setProgress] = useState(null) // totales mientras sincroniza
  const status = error ? null : data ?? null

  async function sync() {
    setProgress({ imported: 0, linked: 0, skipped: 0, errors: [], hasMore: true })
    try {
      const result = await syncIgpsport(setProgress)
      toast(syncMessage(result), result.skipped && !result.imported ? 'info' : 'success')
      setStatus((s) => ({ ...s, lastSyncAt: result.lastSyncAt }))
      if (result.imported) refresh()
      return result
    } catch (err) {
      toast(err.message, 'error')
      // 409: sin conexión o sesión caducada; hay que volver a conectar
      if (err.status === 409) setStatus((s) => ({ ...s, connected: false }))
      return null
    } finally {
      setProgress(null)
    }
  }

  async function connect(email, password) {
    const next = await connectIgpsport(email, password)
    setStatus(next)
    return next
  }

  async function disconnect() {
    try {
      await disconnectIgpsport()
      setStatus((s) => ({ ...s, connected: false }))
      toast('iGPSPORT desconectado. Tus salidas importadas se conservan.', 'info')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return { status, syncing: Boolean(progress), progress, sync, connect, disconnect }
}
