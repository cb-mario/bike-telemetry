import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { rangeQuery } from './ranges'

// Múltiplo de 2 y 3 para completar las filas del grid de salidas
const PAGE_SIZE = 12

// Carga todo lo que depende del rango. Mientras recarga, conserva los datos anteriores
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
      api('/activities', { query: { from, limit: PAGE_SIZE } }),
    ])
      .then(([summary, evolution, zones, activities]) => {
        if (cancelled) return
        setData({ summary, evolution, zones, activities, from })
        setError('')
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setSettledKey(`${range}:${refreshKey}`))

    return () => {
      cancelled = true
    }
  }, [range, refreshKey])

  const loadMoreActivities = useCallback(async () => {
    if (!data) return
    const page = await api('/activities', {
      query: { from: data.from, limit: PAGE_SIZE, offset: data.activities.data.length },
    })
    setData((prev) => ({
      ...prev,
      activities: { ...page, data: [...prev.activities.data, ...page.data] },
    }))
  }, [data])

  return { data, loading, error, loadMoreActivities }
}
