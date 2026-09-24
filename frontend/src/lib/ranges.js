import { todayInput } from './format'

// Rangos del filtro superior: cada uno fija "from" y la granularidad de la evolución
export const RANGES = [
  { value: '4w', label: '4 semanas', weeks: 4, period: 'week' },
  { value: '12w', label: '12 semanas', weeks: 12, period: 'week' },
  { value: '12m', label: '12 meses', months: 12, period: 'month' },
]

export function rangeQuery(value) {
  const range = RANGES.find((r) => r.value === value) ?? RANGES[0]
  const [y, m, d] = todayInput().split('-').map(Number)
  // Periodos completos: desde el día 1 del mes o el lunes de la semana más antigua
  const today = new Date(Date.UTC(y, m - 1, d))
  const daysSinceMonday = (today.getUTCDay() + 6) % 7
  const from = range.months
    ? new Date(Date.UTC(y, m - 1 - (range.months - 1), 1))
    : new Date(Date.UTC(y, m - 1, d - daysSinceMonday - (range.weeks - 1) * 7))
  return { from: from.toISOString().slice(0, 10), period: range.period }
}
