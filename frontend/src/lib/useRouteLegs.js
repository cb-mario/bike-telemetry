import { useEffect, useRef, useState } from 'react'
import { getLeg } from './planner'

const legKey = (a, b, routing) => `${routing}:${a.lat.toFixed(6)},${a.lon.toFixed(6)}>${b.lat.toFixed(6)},${b.lon.toFixed(6)}`
const straight = (a, b) => [[a.lat, a.lon, null], [b.lat, b.lon, null]]

// Tramos entre waypoints consecutivos. Cada tramo se pide una sola vez (caché por puntos y perfil),
// así añadir o mover un punto solo recalcula los tramos afectados
export function useRouteLegs(waypoints, routing) {
  const requested = useRef(new Set()) // tramos ya pedidos (solo se usa en el efecto)
  const [results, setResults] = useState({}) // clave → { status, coords, error? }

  const pairs = waypoints.slice(1).map((b, i) => [waypoints[i], b])

  useEffect(() => {
    if (routing === 'straight') return
    for (const [a, b] of pairs) {
      const key = legKey(a, b, routing)
      if (requested.current.has(key)) continue
      requested.current.add(key)
      getLeg(a, b, routing)
        .then((res) => ({ status: 'ok', coords: res.coords }))
        .catch((err) => ({ status: 'error', coords: straight(a, b), error: err.message }))
        .then((result) => setResults((prev) => ({ ...prev, [key]: result })))
    }
  })

  const legs = pairs.map(([a, b]) => (routing === 'straight'
    ? { status: 'ok', coords: straight(a, b) }
    : results[legKey(a, b, routing)] ?? { status: 'loading', coords: straight(a, b) }))

  // Trazado completo sin duplicar el punto de unión entre tramos
  const geometry = legs.flatMap((leg, i) => (i === 0 ? leg.coords : leg.coords.slice(1)))

  return {
    legs,
    geometry,
    loading: legs.some((l) => l.status === 'loading'),
    error: legs.find((l) => l.status === 'error')?.error ?? null,
  }
}
