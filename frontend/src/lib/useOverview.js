import { useEffect, useState } from 'react'
import { api } from './api'
import { todayInput } from './format'

const pad = (n) => String(n).padStart(2, '0')

// Mismo tramo del mes anterior (del día 1 al día de hoy, recortado si el mes anterior es más corto),
// para comparar el mes en curso con algo equivalente y no con un mes completo
function previousMonthToDate(today) {
  const [y, m, d] = today.split('-').map(Number)
  const prevYear = m === 1 ? y - 1 : y
  const prevMonth = m === 1 ? 12 : m - 1
  const lastDay = new Date(prevYear, prevMonth, 0).getDate()
  const prefix = `${prevYear}-${pad(prevMonth)}`
  return { from: `${prefix}-01`, to: `${prefix}-${pad(Math.min(d, lastDay))}` }
}

// Resumen global (todo el historial), del mes en curso y del mismo tramo del mes anterior,
// independiente del filtro de periodo
export function useOverview(refreshKey) {
  const [overview, setOverview] = useState(null)

  useEffect(() => {
    let cancelled = false
    const today = todayInput()
    const monthStart = `${today.slice(0, 7)}-01`
    const previous = previousMonthToDate(today)

    Promise.all([
      api('/stats/summary'),
      api('/stats/summary', { query: { from: monthStart } }),
      api('/stats/summary', { query: previous }),
    ])
      .then(([total, month, prevMonth]) => !cancelled && setOverview({ total, month, prevMonth, monthStart, prevMonthStart: previous.from }))
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return overview
}
