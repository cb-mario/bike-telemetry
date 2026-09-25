import { api } from './api'
import { useApiQuery } from './useApiQuery'

// Resumen global (todo el historial), del mes en curso y del mismo tramo del mes anterior,
// independiente del filtro de periodo. El backend lo calcula de una vez en la zona del usuario
export function useOverview(refreshKey) {
  const { data } = useApiQuery(() => api('/stats/overview'), [refreshKey])
  return data ?? null
}
