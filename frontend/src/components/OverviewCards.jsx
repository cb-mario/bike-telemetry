import { Card } from './ui/Card'
import { Label, Metric } from './ui/Text'
import { formatDuration, formatMonthName, formatNumber } from '../lib/format'

const ICONS = {
  route: 'M4 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm16-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 17h7a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h7',
  heart: 'M19.5 12.6 12 20l-7.5-7.4A5 5 0 0 1 12 6a5 5 0 0 1 7.5 6.6ZM4 12h4l2-3 3 6 2-3h5',
  calendar: 'M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
}

function OverviewCard({ icon, label, value, unit, sub }) {
  return (
    <Card as="div" className="flex flex-col gap-4 p-5 transition-colors duration-200 hover:border-zinc-700">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <svg viewBox="0 0 24 24" className="size-4 text-zinc-500" fill="none" stroke="currentColor"
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={ICONS[icon]} />
        </svg>
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
    <div className="grid gap-4 sm:grid-cols-3">
      <OverviewCard
        icon="route" label="Km totales"
        value={formatNumber(total.distanceKm, 1)} unit="km"
        sub={total.count
          ? `${total.count === 1 ? '1 salida' : `${formatNumber(total.count)} salidas`} · ${formatDuration(total.durationMin)}`
          : 'Aún no hay salidas'}
      />
      <OverviewCard
        icon="heart" label="FC media general"
        value={formatNumber(total.avgHr)} unit={total.avgHr != null ? 'bpm' : undefined}
        sub={total.maxHr != null ? `Máxima registrada ${total.maxHr} bpm` : 'Sin datos de pulso'}
      />
      <OverviewCard
        icon="calendar" label="Salidas del mes"
        value={formatNumber(month.count)}
        sub={`${formatNumber(month.distanceKm, 1)} km en ${formatMonthName(monthStart)}`}
      />
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3" aria-busy="true" aria-label="Cargando resumen">
      {[0, 1, 2].map((i) => (
        <Card as="div" key={i} className="flex h-[134px] flex-col justify-between p-5">
          <div className="h-3 w-24 animate-pulse rounded bg-zinc-800" />
          <div className="h-8 w-32 animate-pulse rounded bg-zinc-800" />
        </Card>
      ))}
    </div>
  )
}
