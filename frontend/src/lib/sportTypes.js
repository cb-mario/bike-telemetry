// Etiquetas de los tipos de salida (identificadores de Strava)
export const SPORT_TYPES = [
  { value: 'Ride', label: 'Carretera' },
  { value: 'GravelRide', label: 'Gravel' },
  { value: 'MountainBikeRide', label: 'MTB' },
  { value: 'VirtualRide', label: 'Virtual' },
  { value: 'EBikeRide', label: 'E-bike' },
  { value: 'EMountainBikeRide', label: 'E-MTB' },
]

export const sportLabel = (type) => SPORT_TYPES.find((t) => t.value === type)?.label ?? 'Salida'

export const SOURCE_LABEL = { strava: 'Strava', gpx: 'GPX', manual: 'Manual' }
