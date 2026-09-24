import { useState } from 'react'
import { Card, CardHeader } from './ui/Card'
import { SegmentedControl } from './ui/SegmentedControl'
import { Label } from './ui/Text'
import { useElementSize } from '../lib/useElementSize'
import { formatDate, formatDuration, formatKm, formatMonth, formatMonthYear, formatNumber, formatShortDate } from '../lib/format'

const METRICS = [
  // fill: acento del dato (azul distancia, ámbar desnivel)
  { value: 'distanceKm', label: 'Distancia', unit: 'km', fill: 'fill-dist', format: (v) => formatKm(v) },
  { value: 'elevationGain', label: 'Desnivel', unit: 'm', fill: 'fill-elev', format: (v) => `${formatNumber(v)} m` },
  { value: 'durationMin', label: 'Tiempo', unit: 'h', fill: 'fill-dist', format: (v) => formatDuration(v), scale: (v) => v / 60 },
]

const VIEWS = [
  { value: 'chart', label: 'Gráfico' },
  { value: 'table', label: 'Tabla' },
]

const MIN_HEIGHT = 280
const MARGIN = { top: 20, right: 4, bottom: 28, left: 40 }
const MAX_BAR = 24
const RADIUS = 4

// Paso "redondo" del eje (1, 2, 2.5, 5 × 10^n) y máximo ajustado al dato
function niceScale(max, ticks = 4) {
  if (max <= 0) return { max: ticks, step: 1 }
  const raw = max / ticks
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)
  return { max: Math.ceil(max / step) * step, step }
}

// Columna con extremo superior redondeado y base recta
function columnPath(x, y, w, h) {
  const r = Math.min(RADIUS, w / 2, h)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

function periodLabel(bucket, period, long = false) {
  if (period === 'month') return long ? formatMonthYear(bucket.periodStart) : formatMonth(bucket.periodStart)
  return long ? `Semana del ${formatDate(bucket.periodStart)}` : formatShortDate(bucket.periodStart)
}

export function EvolutionChart({ evolution, summary, loading }) {
  const [metricKey, setMetricKey] = useState('distanceKm')
  const [view, setView] = useState('chart')
  const metric = METRICS.find((m) => m.value === metricKey)
  const { period, buckets } = evolution

  return (
    <Card className="flex flex-1 flex-col">
      <CardHeader
        title={`${metric.label} por ${period === 'month' ? 'mes' : 'semana'}`}
        description={`${buckets.length} ${period === 'month' ? 'meses' : 'semanas'}`}
        action={
          <div className="flex flex-wrap gap-2">
            <SegmentedControl label="Métrica" options={METRICS} value={metricKey} onChange={setMetricKey} />
            <SegmentedControl label="Vista" options={VIEWS} value={view} onChange={setView} />
          </div>
        }
      />
      <PeriodSummary summary={summary} loading={loading} />
      <div className={`flex flex-1 flex-col px-5 pt-4 pb-5 transition-opacity ${loading ? 'opacity-50' : ''}`}>
        {view === 'chart'
          ? <Columns buckets={buckets} period={period} metric={metric} />
          : <EvolutionTable buckets={buckets} period={period} />}
      </div>
    </Card>
  )
}

// Totales del periodo seleccionado, en una fila compacta
function PeriodSummary({ summary: s, loading }) {
  const items = [
    ['Distancia', formatKm(s.distanceKm)],
    ['Tiempo', formatDuration(s.durationMin)],
    ['Desnivel', `${formatNumber(s.elevationGain)} m`],
    ['Vel. media', s.avgSpeedKmh != null ? `${formatNumber(s.avgSpeedKmh, 1)} km/h` : '—'],
  ]
  return (
    <dl className={`mx-5 mt-4 grid grid-cols-2 gap-4 border-b border-zinc-800 pb-4 transition-opacity sm:grid-cols-4 ${loading ? 'opacity-50' : ''}`}>
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <Label as="dt">{label}</Label>
          <dd className="mt-1 truncate text-lg font-semibold tracking-tight text-zinc-100">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Columns({ buckets, period, metric }) {
  // El gráfico ocupa todo el alto disponible de la tarjeta (mínimo MIN_HEIGHT)
  const [ref, { width, height: HEIGHT }] = useElementSize()
  const [active, setActive] = useState(null)

  const scale = metric.scale ?? ((v) => v)
  const values = buckets.map((b) => scale(b[metric.value]))
  const { max, step } = niceScale(Math.max(...values, 0))
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step)

  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 0)
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom
  const band = buckets.length ? plotW / buckets.length : 0
  const barW = Math.min(MAX_BAR, band * 0.6)
  const y = (v) => MARGIN.top + plotH - (v / max) * plotH
  const xCenter = (i) => MARGIN.left + band * i + band / 2

  // Etiquetas del eje X espaciadas para que no choquen (~48px cada una)
  const labelEvery = Math.max(1, Math.ceil(48 / (band || 1)))
  // Etiqueta directa solo en el valor máximo
  const maxIndex = values.indexOf(Math.max(...values))
  const activeBucket = active != null ? buckets[active] : null

  return (
    <div ref={ref} className="relative flex-1" style={{ minHeight: MIN_HEIGHT }} onPointerLeave={() => setActive(null)}>
      {width > 0 && HEIGHT > 0 && (
        <svg width={width} height={HEIGHT} className="absolute inset-0" role="img"
          aria-label={`${metric.label} por ${period === 'month' ? 'mes' : 'semana'}. Usa la vista de tabla para ver todos los valores.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)}
                stroke={t === 0 ? '#52525b' : '#27272a'} strokeWidth="1" shapeRendering="crispEdges" />
              <text x={MARGIN.left - 8} y={y(t)} dy="0.32em" textAnchor="end"
                className="fill-ink-muted text-[11px] tabular-nums">
                {formatNumber(t, step < 1 ? 1 : 0)}
              </text>
            </g>
          ))}
          <text x={MARGIN.left - 8} y={MARGIN.top - 10} textAnchor="end" className="fill-ink-muted text-[11px]">
            {metric.unit}
          </text>

          {buckets.map((b, i) => {
            const v = values[i]
            const h = (v / max) * plotH
            const x = xCenter(i) - barW / 2
            return (
              <g key={b.periodStart}>
                {v > 0 && (
                  <path d={columnPath(x, y(v), barW, h)}
                    className={`${metric.fill} transition-[filter] duration-150 ${active === i ? 'brightness-130' : ''}`} />
                )}
                {i % labelEvery === 0 && (
                  <text x={xCenter(i)} y={HEIGHT - 8} textAnchor="middle" className="fill-ink-muted text-[11px]">
                    {periodLabel(b, period)}
                  </text>
                )}
                {i === maxIndex && v > 0 && (
                  <text x={xCenter(i)} y={y(v) - 6} textAnchor="middle" className="fill-ink-secondary text-[11px] font-medium">
                    {metric.format(b[metric.value])}
                  </text>
                )}
                {/* Zona interactiva: toda la banda, más grande que la columna */}
                <rect x={MARGIN.left + band * i} y={MARGIN.top} width={band} height={plotH}
                  fill="transparent" tabIndex={0} className="cursor-default outline-none"
                  aria-label={`${periodLabel(b, period, true)}: ${metric.format(b[metric.value])}`}
                  onPointerEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} />
              </g>
            )
          })}
        </svg>
      )}

      {activeBucket && (
        <div
          className={`pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-zinc-700/80 bg-zinc-950/95 px-3 py-2 text-xs shadow-xl backdrop-blur
            ${xCenter(active) > width / 2 ? '-translate-x-full' : ''}`}
          // Al lado de la columna activa (a la izquierda si está en la mitad derecha) para no taparla
          style={{ left: xCenter(active) + (xCenter(active) > width / 2 ? -1 : 1) * (barW / 2 + 8) }}
        >
          <p className="text-sm font-semibold text-ink">{metric.format(activeBucket[metric.value])}</p>
          <p className="text-ink-secondary">{periodLabel(activeBucket, period, true)}</p>
          <p className="mt-1 text-ink-muted">
            {activeBucket.count === 1 ? '1 salida' : `${activeBucket.count} salidas`}
            {activeBucket.avgSpeedKmh != null && ` · ${formatNumber(activeBucket.avgSpeedKmh, 1)} km/h`}
          </p>
        </div>
      )}
    </div>
  )
}

function EvolutionTable({ buckets, period }) {
  return (
    <div className="relative flex-1" style={{ minHeight: MIN_HEIGHT }}>
      <div className="absolute inset-0 overflow-auto">
        <table className="w-full min-w-[26rem] text-left text-xs whitespace-nowrap tabular-nums">
          <thead className="sticky top-0 bg-zinc-900 text-[10px] tracking-wider text-zinc-400 uppercase">
            <tr className="border-b border-zinc-800">
              <th className="py-2 font-medium">{period === 'month' ? 'Mes' : 'Semana'}</th>
              <th className="py-2 pl-4 text-right font-medium">Salidas</th>
              <th className="py-2 pl-4 text-right font-medium">Distancia</th>
              <th className="py-2 pl-4 text-right font-medium">Desnivel</th>
              <th className="py-2 pl-4 text-right font-medium">Tiempo</th>
            </tr>
          </thead>
          <tbody className="text-ink-secondary">
            {[...buckets].reverse().map((b) => (
              <tr key={b.periodStart} className="border-b border-zinc-900">
                <td className="py-2 text-ink">{periodLabel(b, period, true)}</td>
                <td className="py-2 pl-4 text-right">{b.count}</td>
                <td className="py-2 pl-4 text-right">{formatKm(b.distanceKm)}</td>
                <td className="py-2 pl-4 text-right">{formatNumber(b.elevationGain)} m</td>
                <td className="py-2 pl-4 text-right">{formatDuration(b.durationMin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
