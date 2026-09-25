import { elevationGain, withDistance } from './track'

// Salida de ejemplo para la landing: un recorrido de carretera trazado a mano (rectas por el valle,
// subida a un puerto con horquillas y descenso de curvas amplias). No es la ruta de nadie.
// Todas las cifras que muestra la landing se calculan a partir de estos puntos, igual que en una salida real
const CENTER = [40.74, -3.95]

// Puntos de paso en km (x: este, y: norte) y altitud aproximada en cada uno
const WAYPOINTS = [
  [0, 0, 690], [3.8, 0.4, 700], [7.6, 1.5, 715], [10.9, 3.3, 740], [12.6, 4.4, 770], [13.6, 6.0, 810], [14.2, 7.0, 840],
  // Puerto: cinco horquillas
  [15.9, 7.4, 930], [14.5, 8.1, 1010], [16.1, 8.7, 1100], [14.7, 9.4, 1190], [16.3, 10.0, 1280],
  [14.9, 10.7, 1370], [16.4, 11.3, 1450], [17.1, 11.8, 1490],
  // Descenso por la otra vertiente y vuelta por el valle
  [16.2, 13.4, 1380], [14.1, 14.6, 1240], [11.4, 14.9, 1080], [8.6, 14.1, 960], [6.3, 12.6, 880],
  [4.1, 11.9, 820], [2.6, 9.8, 770], [1.4, 7.0, 745], [-0.4, 4.6, 720], [-0.6, 2.0, 700], [0, 0, 690],
]

// Suaviza las esquinas (Chaikin) sin perder las horquillas, que están muy juntas
function chaikin(pts, rounds) {
  let out = pts
  for (let r = 0; r < rounds; r++) {
    const next = [out[0]]
    for (let i = 0; i < out.length - 1; i++) {
      const [a, b] = [out[i], out[i + 1]]
      next.push(a.map((v, k) => v * 0.75 + b[k] * 0.25), a.map((v, k) => v * 0.25 + b[k] * 0.75))
    }
    next.push(out.at(-1))
    out = next
  }
  return out
}

// Densifica a un punto cada ~150 m, con un leve ondulado del terreno
function densify(pts) {
  const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]]
    const steps = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.15))
    for (let j = 0; j < steps; j++) out.push(a.map((v, k) => v + (b[k] - v) * (j / steps)))
  }
  out.push(pts.at(-1))
  return out
}

const KM_PER_DEG_LAT = 111.2
const kmPerDegLon = KM_PER_DEG_LAT * Math.cos((CENTER[0] * Math.PI) / 180)
const path = densify(chaikin(WAYPOINTS, 2))

// Altitud suavizada a lo largo del recorrido (sin escalones en las horquillas) con repechos irregulares
const SMOOTH = 12
const rawEle = path.map((p) => p[2])
const elevations = rawEle.map((_, i) => {
  const w = rawEle.slice(Math.max(0, i - SMOOTH), i + SMOOTH + 1)
  const base = w.reduce((sum, e) => sum + e, 0) / w.length
  return base + 9 * Math.sin(i / 11) + 5 * Math.sin(i / 4.3 + 1) + 3 * Math.sin(i / 1.7)
})

const coords = path.map(([x, y], i) => [
  +(CENTER[0] + y / KM_PER_DEG_LAT).toFixed(6),
  +(CENTER[1] + x / kmPerDegLon).toFixed(6),
  Math.round(elevations[i]),
])

// Pulso siguiendo la pendiente: sube en el puerto, baja en los descensos
const hr = coords.map((c, i) => {
  const prev = coords[Math.max(0, i - 6)][2]
  const grade = (c[2] - prev) / 6
  return Math.round(Math.min(178, Math.max(112, 132 + grade * 2.6 + 5 * Math.sin(i / 23))))
})

const segments = [coords.map((c, i) => [...c, null, hr[i]])]

export const DEMO_POINTS = withDistance(segments)
export const DEMO_SEGMENTS = [coords.map(([lat, lon]) => [lat, lon])]

const distanceKm = DEMO_POINTS.at(-1).km
const durationMin = Math.round((distanceKm / 25) * 60)
const avgHr = Math.round(hr.reduce((s, h) => s + h, 0) / hr.length)

// Reparto aproximado del tiempo por zona (FC máx. de ejemplo: 190 bpm)
const ZONE_FROM = [0.5, 0.6, 0.7, 0.8, 0.9].map((p) => Math.round(p * 190))
const zoneShare = ZONE_FROM.map((from, z) => {
  const to = ZONE_FROM[z + 1] ?? Infinity
  return hr.filter((h) => h >= from && h < to).length / hr.length
})

export const DEMO_RIDE = {
  title: 'Vuelta por el puerto',
  distanceKm,
  durationMin,
  avgHr,
  maxHr: Math.max(...hr),
  elevationGain: elevationGain(coords),
  zoneShare,
}
