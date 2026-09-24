import { todayInput } from './format'

export const DISTANCE_FILTERS = [
  { value: '', label: 'Cualquier distancia' },
  { value: '0-30', label: 'Menos de 30 km', maxKm: 30 },
  { value: '30-60', label: '30 – 60 km', minKm: 30, maxKm: 60 },
  { value: '60-100', label: '60 – 100 km', minKm: 60, maxKm: 100 },
  { value: '100-', label: 'Más de 100 km', minKm: 100 },
]

export const ELEVATION_FILTERS = [
  { value: '', label: 'Cualquier desnivel' },
  { value: 'flat', label: 'Llano · < 300 m', maxElevation: 300 },
  { value: 'rolling', label: 'Media · 300 – 1000 m', minElevation: 300, maxElevation: 1000 },
  { value: 'mountain', label: 'Montaña · > 1000 m', minElevation: 1000 },
]

const daysAgo = (n) => {
  const d = new Date(`${todayInput()}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

export const DATE_FILTERS = [
  { value: '', label: 'Cualquier fecha' },
  { value: '30d', label: 'Últimos 30 días', from: () => daysAgo(29) },
  { value: '90d', label: 'Últimos 3 meses', from: () => daysAgo(89) },
  { value: 'year', label: 'Este año', from: () => `${todayInput().slice(0, 4)}-01-01` },
]

// Filtros de la UI → parámetros de la API
export function filtersToQuery({ q, distance, elevation, date, sportType }) {
  const d = DISTANCE_FILTERS.find((f) => f.value === distance) ?? {}
  const e = ELEVATION_FILTERS.find((f) => f.value === elevation) ?? {}
  const t = DATE_FILTERS.find((f) => f.value === date)
  return {
    q: q.trim() || undefined,
    minKm: d.minKm, maxKm: d.maxKm,
    minElevation: e.minElevation, maxElevation: e.maxElevation,
    from: t?.from?.(),
    sportType: sportType || undefined,
  }
}

export const EMPTY_FILTERS = { q: '', distance: '', elevation: '', date: '', sportType: '' }

export const hasActiveFilters = (filters) => Object.values(filters).some((v) => v !== '')
