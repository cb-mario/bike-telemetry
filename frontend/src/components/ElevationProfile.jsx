import { useMemo } from 'react'
import { useElementSize } from '../lib/useElementSize'
import { formatNumber } from '../lib/format'
import { sample } from '../lib/track'

const HEIGHT = 200
const M = { top: 16, right: 12, bottom: 26, left: 44 }

function niceStep(span, ticks = 4) {
  const raw = span / ticks
  const mag = 10 ** Math.floor(Math.log10(raw || 1))
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)
}

// Perfil de altitud (área ámbar) con cursor que informa del punto activo
export function ElevationProfile({ points, activeIndex, onActiveChange }) {
  const [ref, { width }] = useElementSize()
  const data = useMemo(() => sample(points.filter((p) => p.ele != null), 800), [points])

  if (data.length < 2) return null
  const maxKm = data.at(-1).km || 1
  const eles = data.map((p) => p.ele)
  const minEle = Math.min(...eles)
  const maxEle = Math.max(...eles)
  const step = niceStep(Math.max(maxEle - minEle, 20))
  const lo = Math.floor(minEle / step) * step
  const hi = Math.ceil(maxEle / step) * step
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step)
  const kmStep = niceStep(maxKm, 5)
  const kmTicks = Array.from({ length: Math.floor(maxKm / kmStep) + 1 }, (_, i) => i * kmStep)

  const plotW = Math.max(width - M.left - M.right, 0)
  const plotH = HEIGHT - M.top - M.bottom
  const x = (km) => M.left + (km / maxKm) * plotW
  const y = (ele) => M.top + plotH - ((ele - lo) / (hi - lo || 1)) * plotH

  const line = data.map((p, i) => `${i ? 'L' : 'M'}${x(p.km).toFixed(1)},${y(p.ele).toFixed(1)}`).join('')
  const area = `${line}L${x(maxKm)},${M.top + plotH}L${x(0)},${M.top + plotH}Z`
  const active = activeIndex != null ? data[activeIndex] : null

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const km = ((e.clientX - rect.left - M.left) / plotW) * maxKm
    // Punto más cercano por distancia (los datos están ordenados por km)
    let lo2 = 0
    let hi2 = data.length - 1
    while (hi2 - lo2 > 1) {
      const mid = (lo2 + hi2) >> 1
      if (data[mid].km < km) lo2 = mid
      else hi2 = mid
    }
    const i = Math.abs(data[lo2].km - km) < Math.abs(data[hi2].km - km) ? lo2 : hi2
    onActiveChange(i, data[i])
  }

  return (
    <div ref={ref} className="relative" onPointerLeave={() => onActiveChange(null, null)}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} onPointerMove={handleMove} className="touch-none"
          role="img" aria-label={`Perfil de altitud: de ${formatNumber(minEle)} a ${formatNumber(maxEle)} m a lo largo de ${formatNumber(maxKm, 1)} km`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="#27272a" shapeRendering="crispEdges" />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-zinc-500 text-[11px] tabular-nums">{formatNumber(t)}</text>
            </g>
          ))}
          {kmTicks.map((k) => (
            <text key={k} x={x(k)} y={HEIGHT - 6} textAnchor="middle" className="fill-zinc-500 text-[11px] tabular-nums">
              {formatNumber(k, kmStep < 1 ? 1 : 0)}
            </text>
          ))}
          <text x={M.left - 8} y={M.top - 6} textAnchor="end" className="fill-zinc-500 text-[11px]">m</text>
          <text x={width - M.right} y={HEIGHT - 6} textAnchor="end" className="fill-zinc-500 text-[11px]">km</text>

          <path d={area} className="fill-elev/15" />
          <path d={line} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="stroke-elev" />

          {active && (
            <g>
              <line x1={x(active.km)} x2={x(active.km)} y1={M.top} y2={M.top + plotH} stroke="#71717a" />
              <circle cx={x(active.km)} cy={y(active.ele)} r="5" strokeWidth="2" className="fill-elev stroke-zinc-900" />
            </g>
          )}
        </svg>
      )}
      {active && (
        <div className={`pointer-events-none absolute top-0 rounded-lg border border-zinc-700/80 bg-zinc-950/95 px-3 py-2 text-xs shadow-xl
          ${x(active.km) > width / 2 ? '-translate-x-full' : ''}`}
          style={{ left: x(active.km) + (x(active.km) > width / 2 ? -12 : 12) }}>
          <p className="text-sm font-semibold text-zinc-100">{formatNumber(active.ele)} m</p>
          <p className="text-zinc-400">km {formatNumber(active.km, 1)}{active.hr != null && ` · ${active.hr} bpm`}</p>
        </div>
      )}
    </div>
  )
}
