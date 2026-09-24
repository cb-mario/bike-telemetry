// Utilidades para el track de /activities/:id/track (puntos [lat, lon, ele, t, hr] por segmento)

const R = 6371008.8
const rad = (d) => (d * Math.PI) / 180

function haversine([lat1, lon1], [lat2, lon2]) {
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Puntos con distancia acumulada (km); los saltos entre segmentos no suman distancia
export function withDistance(segments) {
  const out = []
  let km = 0
  for (const seg of segments) {
    seg.forEach((p, i) => {
      if (i > 0) km += haversine(seg[i - 1], p) / 1000
      out.push({ lat: p[0], lon: p[1], ele: p[2], t: p[3], hr: p[4], km })
    })
  }
  return out
}

// Reduce a como mucho `max` puntos (para dibujar el perfil sin miles de vértices)
export function sample(points, max) {
  if (points.length <= max) return points
  const step = (points.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)])
}
