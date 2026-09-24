import { useEffect, useState } from 'react'
import { api } from './api'
import { rangeQuery } from './ranges'

// Datos del Resumen que dependen del rango. Mientras recarga, conserva los datos anteriores
export function useDashboardData(range, refreshKey) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  // Clave de la última petición terminada: si no coincide con la actual, está cargando
  const [settledKey, setSettledKey] = useState(null)
  const requestKey = `${range}:${refreshKey}`
  const loading = settledKey !== requestKey

  useEffect(() => {
    let cancelled = false
    const { from, period } = rangeQuery(range)

    Promise.all([
      api('/stats/summary', { query: { from } }),
      api('/stats/evolution', { query: { from, period } }),
      api('/stats/hr-zones', { query: { from } }),
    ])
      .then(([summary, evolution, zones]) => {
        if (cancelled) return
        setData({ summary, evolution, zones })
        setError('')
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setSettledKey(`${range}:${refreshKey}`))

    return () => {
      cancelled = true
    }
  }, [range, refreshKey])

  return { data, loading, error }
}
