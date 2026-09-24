// Dibujo del recorrido a partir de la miniatura [[lat, lon], ...] por segmento
// Proyección equirectangular corregida por latitud: suficiente para rutas de una salida
export function RoutePreview({ segments, width, height, padding = 4, markers = false, className = '' }) {
  const points = segments.flat()
  if (points.length < 2) return null

  const meanLat = points.reduce((sum, [lat]) => sum + lat, 0) / points.length
  const kx = Math.cos((meanLat * Math.PI) / 180)
  const xs = points.map(([, lon]) => lon * kx)
  const ys = points.map(([lat]) => -lat)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const spanX = Math.max(...xs) - minX || 1e-9
  const spanY = Math.max(...ys) - minY || 1e-9

  // Escala única para no deformar la ruta, centrada en la caja
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY)
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2
  const project = ([lat, lon]) => [offsetX + (lon * kx - minX) * scale, offsetY + (-lat - minY) * scale]

  const paths = segments
    .filter((seg) => seg.length > 1)
    .map((seg) => seg.map((p, i) => `${i ? 'L' : 'M'}${project(p).map((n) => n.toFixed(1)).join(' ')}`).join(''))
  const [start, end] = [project(points[0]), project(points.at(-1))]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-series" />
      ))}
      {markers && (
        <>
          <circle cx={start[0]} cy={start[1]} r="4" strokeWidth="2" className="fill-zinc-100 stroke-zinc-900" />
          <circle cx={end[0]} cy={end[1]} r="4" strokeWidth="2" className="fill-series stroke-zinc-900" />
        </>
      )}
    </svg>
  )
}
