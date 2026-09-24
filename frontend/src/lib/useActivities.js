import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

// Múltiplo de 2 y 3 para completar las filas del grid
const PAGE_SIZE = 12

// Listado paginado según los filtros; conserva los datos anteriores mientras recarga
export function useActivities(query, refreshKey) {
  const [page, setPage] = useState(null)
  const [error, setError] = useState('')
  const [settledKey, setSettledKey] = useState(null)
  const requestKey = `${JSON.stringify(query)}:${refreshKey}`
  const loading = settledKey !== requestKey

  useEffect(() => {
    let cancelled = false
    api('/activities', { query: { ...query, limit: PAGE_SIZE } })
      .then((res) => {
        if (cancelled) return
        setPage(res)
        setError('')
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setSettledKey(requestKey))
    return () => {
      cancelled = true
    }
  }, [query, refreshKey, requestKey])

  const loadMore = useCallback(async () => {
    const next = await api('/activities', { query: { ...query, limit: PAGE_SIZE, offset: page.data.length } })
    setPage((prev) => ({ ...next, data: [...prev.data, ...next.data] }))
  }, [query, page])

  return { page, loading, error, loadMore }
}
