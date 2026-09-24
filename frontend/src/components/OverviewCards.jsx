import { Card } from './ui/Card'
import { Label, Metric } from './ui/Text'
import { formatDuration, formatMonthName, formatNumber } from '../lib/format'
import { useCountUp } from '../lib/useCountUp'

const ICONS = {
  mountain: 'm3 20 6-11 4 6 2-3 6 8H3Z',
  route: 'M4 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm16-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 17h7a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h7',
  heart: 'M19.5 12.6 12 20l-7.5-7.4A5 5 0 0 1 12 6a5 5 0 0 1 7.5 6.6ZM4 12h4l2-3 3 6 2-3h5',
  calendar: 'M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
}

// Acento por tipo de dato: el color va en el icono, las cifras siempre en tinta neutra
const ACCENTS = {
  dist: 'bg-dist/15 text-dist',
  hr: 'bg-hr/15 text-hr',
  elev: 'bg-elev/15 text-elev',
  neutral: 'bg-zinc-800 text-zinc-300',
}

// Cifra que cuenta hacia arriba al aparecer
function Animated({ value, decimals = 0 }) {
  const current = useCountUp(value)
  return current == null ? '—' : formatNumber(current, decimals)
}

function OverviewCard({ icon, accent, label, value, unit, sub, index }) {
  return (
    <Card as="div" style={{ '--i': index }}
      className="group flex flex-col gap-4 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_18px_40px_-22px_rgb(59_130_246/0.6)]">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className={`flex size-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 ${ACCENTS[accent]}`}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor"
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={ICONS[icon]} />
          </svg>
        </span>
      </div>
      <div>
        <Metric value={value} unit={unit} />
        <p className="mt-1.5 text-xs text-zinc-500">{sub}</p>
      </div>
    </Card>
  )
}

export function OverviewCards({ overview }) {
  if (!overview) return <OverviewSkeleton />
  const { total, month, monthStart } = overview

  return (
    <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <OverviewCard index={0}
        icon="route" accent="dist" label="Km totales"
        value={<Animated value={total.distanceKm} decimals={1} />} unit="km"
        sub={total.count
          ? `${total.count === 1 ? '1 salida' : `${formatNumber(total.count)} salidas`} · ${formatDuration(total.durationMin)}`
          : 'Aún no hay salidas'}
      />
      <OverviewCard index={1}
        icon="heart" accent="hr" label="FC media"
        value={<Animated value={total.avgHr} />} unit={total.avgHr != null ? 'bpm' : undefined}
        sub={total.maxHr != null ? `Máxima registrada ${total.maxHr} bpm` : 'Sin datos de pulso'}
      />
      <OverviewCard index={2}
        icon="calendar" accent="neutral" label="Salidas del mes"
        value={<Animated value={month.count} />}
        sub={`${formatNumber(month.distanceKm, 1)} km en ${formatMonthName(monthStart)}`}
      />
      <OverviewCard index={3}
        icon="mountain" accent="elev" label="Desnivel acumulado"
        value={<Animated value={total.elevationGain} />} unit="m"
        sub={total.distanceKm ? `${formatNumber(total.elevationGain / total.distanceKm, 1)} m por km` : 'Aún no hay salidas'}
      />
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Cargando resumen">
      {[0, 1, 2, 3].map((i) => (
        <Card as="div" key={i} className="flex h-[134px] flex-col justify-between p-5">
          <div className="h-3 w-24 animate-pulse rounded bg-zinc-800" />
          <div className="h-8 w-32 animate-pulse rounded bg-zinc-800" />
        </Card>
      ))}
    </div>
  )
}
