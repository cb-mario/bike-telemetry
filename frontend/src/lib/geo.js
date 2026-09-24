// Límites que contienen todas las coordenadas [[lat, lon], ...]
export function boundsOf(coords) {
  if (!coords.length) return null
  let [minLat, minLon, maxLat, maxLon] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [lat, lon] of coords) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
  }
  return [[minLat, minLon], [maxLat, maxLon]]
}
