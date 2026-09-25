import { Card } from './ui/Card'
import { Label, Metric } from './ui/Text'
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

// Una lectura del panel: etiqueta con su marca de color, cifra y contexto
function Reading({ accent, label, value, unit, sub }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 bg-zinc-900 p-4 sm:p-5">
      <Label className="flex items-start gap-2">
        <span aria-hidden className={`mt-0.5 h-3 w-0.5 shrink-0 rounded-full ${ACCENTS[accent]}`} />
        {label}
      </Label>
      <div>
        <Metric value={value} unit={unit} size="text-2xl sm:text-3xl" />
        <p className="mt-1 text-xs text-zinc-500">{sub}</p>
      </div>
    </div>
  )
}

// Panel único con cuatro lecturas separadas por filetes (2×2 en móvil, 4 en fila en escritorio)
export function OverviewCards({ overview }) {
  if (!overview) return <OverviewSkeleton />
  const { total, month, monthStart } = overview

  return (
    <Card as="div" className="overflow-hidden animate-rise-in">
      <div className="grid grid-cols-2 gap-px bg-zinc-800 lg:grid-cols-4">
      <Reading accent="dist" label="Km totales"
        value={<Animated value={total.distanceKm} decimals={1} />} unit="km"
        sub={total.count
          ? `${total.count === 1 ? '1 salida' : `${formatNumber(total.count)} salidas`} · ${formatDuration(total.durationMin)}`
          : 'Aún no hay salidas'}
      />
      <Reading accent="hr" label="FC media"
        value={<Animated value={total.avgHr} />} unit={total.avgHr != null ? 'bpm' : undefined}
        sub={total.maxHr != null ? `Máxima registrada ${total.maxHr} bpm` : 'Sin datos de pulso'}
      />
      <Reading accent="neutral" label="Salidas del mes"
        value={<Animated value={month.count} />}
        sub={`${formatNumber(month.distanceKm, 1)} km en ${formatMonthName(monthStart)}`}
      />
      <Reading accent="elev" label="Desnivel acumulado"
        value={<Animated value={total.elevationGain} />} unit="m"
        sub={total.distanceKm ? `${formatNumber(total.elevationGain / total.distanceKm, 1)} m por km` : 'Aún no hay salidas'}
      />
      </div>
    </Card>
  )
}

function OverviewSkeleton() {
  return (
    <Card as="div" className="grid grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Cargando resumen">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex h-[124px] flex-col justify-between p-5">
          <div className="h-3 w-24 animate-pulse rounded bg-zinc-800" />
          <div className="h-8 w-32 animate-pulse rounded bg-zinc-800" />
        </div>
      ))}
    </Card>
  )
}
