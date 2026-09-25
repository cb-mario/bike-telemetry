import { api } from './api'
import { rangeQuery } from './ranges'
import { useApiQuery } from './useApiQuery'

// Datos del Resumen que dependen del rango. Mientras recarga, conserva los datos anteriores
export function useDashboardData(range, refreshKey) {
  const { data, loading, error } = useApiQuery(async () => {
    const { from, period } = rangeQuery(range)
    const [summary, evolution, zones] = await Promise.all([
      api('/stats/summary', { query: { from } }),
      api('/stats/evolution', { query: { from, period } }),
      api('/stats/hr-zones', { query: { from } }),
    ])
    return { summary, evolution, zones }
  }, [range, refreshKey])

  return { data: data ?? null, loading, error }
}
