import { Card, CardHeader } from './ui/Card'
import { Label, Metric } from './ui/Text'
import { Icon } from './ui/Icon'
import { formatDuration, formatMonthName, formatNumber } from '../lib/format'
import { useCountUp } from '../lib/useCountUp'

// Acento por tipo de dato: una marca junto a la etiqueta; las cifras siempre en tinta neutra
const ACCENTS = {
  dist: 'bg-dist',
  hr: 'bg-hr',
  elev: 'bg-elev',
  neutral: 'bg-zinc-500',
}

// Cifra que cuenta hacia arriba al aparecer
function Animated({ value, decimals = 0 }) {
  const current = useCountUp(value)
  return current == null ? '—' : formatNumber(current, decimals)
}

// Una lectura de panel: etiqueta con su marca de color, cifra y contexto.
// Va dentro de una rejilla `gap-px bg-zinc-800` para que los filetes salgan del hueco
export function Reading({ accent = 'neutral', label, value, unit, sub, size = 'text-2xl sm:text-3xl', className = '' }) {
  return (
    <div className={`flex min-w-0 flex-col gap-3 bg-zinc-900 p-4 sm:p-5 ${className}`}>
      <Label className="flex items-start gap-2">
        <span aria-hidden className={`mt-0.5 h-3 w-0.5 shrink-0 rounded-full ${ACCENTS[accent]}`} />
        {label}
      </Label>
      <div className="min-w-0">
        <Metric value={value} unit={unit} size={size} className="truncate" />
        {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
      </div>
    </div>
  )
}

// Variación frente al mismo tramo del mes anterior. Neutra a propósito: rodar menos no es un error
function Delta({ current, previous, month }) {
  if (!previous) {
    return current ? <span>Sin datos en {month} a estas alturas</span> : <span>Igual que en {month}</span>
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return <span>Igual que en {month}</span>
  return (
    <span className="inline-flex items-center gap-1">
      <Icon name={pct > 0 ? 'trendUp' : 'trendDown'} className="size-3.5 text-zinc-300" />
      <span className="font-medium text-zinc-300 tabular-nums">{pct > 0 ? '+' : '−'}{formatNumber(Math.abs(pct))} %</span>
      <span>vs. {month}</span>
    </span>
  )
}

// El mes en curso comparado con el mismo tramo del anterior: cuatro lecturas con su tendencia
export function MonthPanel({ overview }) {
  if (!overview) return <PanelSkeleton cells={4} className="h-[300px]" />
  const { month, prevMonth, monthStart, prevMonthStart } = overview
  const name = formatMonthName(monthStart)
  const title = `${name.charAt(0).toUpperCase()}${name.slice(1)}, hasta hoy`
  const prevName = formatMonthName(prevMonthStart)
  const today = new Date().getDate()

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader title={title}
        description={`Del 1 al ${today}, frente al mismo tramo de ${prevName}`} />
      <div className="mt-4 grid flex-1 grid-cols-2 gap-px border-t border-zinc-800 bg-zinc-800">
        <Reading accent="dist" label="Distancia" size="text-2xl"
          value={<Animated value={month.distanceKm} decimals={1} />} unit="km"
          sub={<Delta current={month.distanceKm} previous={prevMonth.distanceKm} month={prevName} />} />
        <Reading label="Salidas" size="text-2xl"
          value={<Animated value={month.count} />}
          sub={<Delta current={month.count} previous={prevMonth.count} month={prevName} />} />
        <Reading label="Tiempo" size="text-2xl"
          value={<Animated value={month.durationMin / 60} decimals={1} />} unit="h"
          sub={<Delta current={month.durationMin} previous={prevMonth.durationMin} month={prevName} />} />
        <Reading accent="elev" label="Desnivel" size="text-2xl"
          value={<Animated value={month.elevationGain} />} unit="m"
          sub={<Delta current={month.elevationGain} previous={prevMonth.elevationGain} month={prevName} />} />
      </div>
    </Card>
  )
}

// Todo el historial en una tira de cuatro lecturas
export function TotalsPanel({ overview }) {
  if (!overview) return <PanelSkeleton cells={4} className="h-[160px]" />
  const { total } = overview

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Desde tu primera salida"
        description={total.count ? `${total.count === 1 ? '1 salida' : `${formatNumber(total.count)} salidas`} registradas` : 'Aún no hay salidas'} />
      <div className="mt-4 grid grid-cols-2 gap-px border-t border-zinc-800 bg-zinc-800 lg:grid-cols-4">
        <Reading accent="dist" label="Km totales"
          value={formatNumber(total.distanceKm, 1)} unit="km"
          sub={total.avgSpeedKmh != null ? `${formatNumber(total.avgSpeedKmh, 1)} km/h de media` : 'Sin datos de velocidad'} />
        <Reading label="Tiempo en movimiento"
          value={formatNumber(Math.round(total.durationMin / 60))} unit="h"
          sub={formatDuration(total.durationMin)} />
        <Reading accent="elev" label="Desnivel acumulado"
          value={formatNumber(total.elevationGain)} unit="m"
          sub={total.distanceKm ? `${formatNumber(total.elevationGain / total.distanceKm, 1)} m por km` : 'Aún no hay salidas'} />
        <Reading accent="hr" label="FC media"
          value={formatNumber(total.avgHr)} unit={total.avgHr != null ? 'bpm' : undefined}
          sub={total.maxHr != null ? `Máxima registrada ${total.maxHr} bpm` : 'Sin datos de pulso'} />
      </div>
    </Card>
  )
}

export function PanelSkeleton({ className = '' }) {
  return (
    <Card as="div" className={`flex flex-col gap-4 p-5 ${className}`} aria-busy="true" aria-label="Cargando">
      <div className="h-3 w-32 animate-pulse rounded bg-zinc-800" />
      <div className="h-8 w-40 animate-pulse rounded bg-zinc-800" />
    </Card>
  )
}
