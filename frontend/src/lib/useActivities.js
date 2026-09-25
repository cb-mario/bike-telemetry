import { useCallback } from 'react'
import { api } from './api'
import { useApiQuery } from './useApiQuery'

// Múltiplo de 2 y 3 para completar las filas del grid
const PAGE_SIZE = 12

// Listado paginado según los filtros; conserva los datos anteriores mientras recarga
export function useActivities(query, refreshKey) {
  const { data: page, loading, error, setData } = useApiQuery(
    () => api('/activities', { query: { ...query, limit: PAGE_SIZE } }),
    [query, refreshKey],
  )

  const loadMore = useCallback(async () => {
    const next = await api('/activities', { query: { ...query, limit: PAGE_SIZE, offset: page.data.length } })
    setData((prev) => ({ ...next, data: [...prev.data, ...next.data] }))
  }, [query, page, setData])

  return { page: page ?? null, loading, error, loadMore }
}
