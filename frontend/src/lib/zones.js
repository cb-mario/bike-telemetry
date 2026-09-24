// Zona de una salida según su FC media y los límites de /stats/hr-zones
// (misma regla que el backend: la zona más alta cuyo mínimo alcanza; por debajo de Z1 → Z1)
export function zoneFor(avgHr, zones) {
  if (avgHr == null || !zones?.length) return null
  return [...zones].reverse().find((z) => avgHr >= z.minBpm) ?? zones[0]
}

export const ZONE_BG = ['bg-zone-1', 'bg-zone-2', 'bg-zone-3', 'bg-zone-4', 'bg-zone-5']
