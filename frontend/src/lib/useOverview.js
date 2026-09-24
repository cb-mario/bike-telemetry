import { useEffect, useState } from 'react'
import { api } from './api'
import { todayInput } from './format'

// Resumen global (todo el historial) y del mes en curso, independiente del filtro de periodo
export function useOverview(refreshKey) {
  const [overview, setOverview] = useState(null)

  useEffect(() => {
    let cancelled = false
    const monthStart = `${todayInput().slice(0, 7)}-01`

    Promise.all([
      api('/stats/summary'),
      api('/stats/summary', { query: { from: monthStart } }),
    ])
      .then(([total, month]) => !cancelled && setOverview({ total, month, monthStart }))
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return overview
}
