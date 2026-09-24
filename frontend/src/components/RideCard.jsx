import { Link } from 'react-router'
import { Card } from './ui/Card'
import { RoutePreview } from './RoutePreview'
import { formatDuration, formatNumber, formatWeekdayDate } from '../lib/format'
import { SOURCE_LABEL, sportLabel } from '../lib/sportTypes'
import { zoneFor } from '../lib/zones'

function Stat({ label, value, accent }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-zinc-400 uppercase">
        {accent && <span aria-hidden className={`size-1.5 rounded-full ${accent}`} />}
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium text-zinc-100 tabular-nums">{value}</dd>
    </div>
  )
}

export function Chip({ children, dot }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/50 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
      {dot && <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />}
      {children}
    </span>
  )
}

export function RideCard({ ride: r, zones, index = 0 }) {
  const zone = zoneFor(r.avgHr, zones)
  return (
    <Card as="li" style={{ '--i': index % 12 }}
      className="group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_24px_48px_-24px_rgb(59_130_246/0.55)]">
      <Link to={`/salidas/${r.id}`} className="flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-series/60">
        {/* Miniatura del trazado sobre una retícula tenue, como un mini-mapa */}
        <div className="relative h-32 border-b border-zinc-800 bg-zinc-950/60 bg-[linear-gradient(rgb(39_39_42/0.35)_1px,transparent_1px),linear-gradient(90deg,rgb(39_39_42/0.35)_1px,transparent_1px)] bg-[size:16px_16px]">
          {r.routePreview ? (
            <RoutePreview segments={r.routePreview} width={320} height={128} padding={14} markers
              className="size-full transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : (
            <p className="flex size-full items-center justify-center text-xs text-zinc-600">Sin recorrido GPS</p>
          )}
          <div className="absolute top-3 left-3 flex gap-1.5">
            <Chip>{sportLabel(r.sportType)}</Chip>
            <Chip dot={r.source === 'strava' ? 'bg-strava' : undefined}>{SOURCE_LABEL[r.source] ?? 'Manual'}</Chip>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wider text-zinc-400 uppercase">{formatWeekdayDate(r.date)}</p>
            <h3 className="mt-1 truncate text-base font-medium text-zinc-100" title={r.title}>{r.title}</h3>
          </div>
          <p className="text-3xl font-semibold tracking-tight text-zinc-100">
            {formatNumber(r.distanceKm, 1)}{' '}
            <span className="ml-0.5 text-base font-normal tracking-normal text-zinc-400">km</span>
          </p>
          <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-zinc-800 pt-4">
            <Stat label="Tiempo" value={formatDuration(r.durationMin)} accent="bg-dist" />
            <Stat label="Desnivel" value={r.elevationGain != null ? `${formatNumber(r.elevationGain)} m` : '—'} accent="bg-elev" />
            <Stat label="FC" value={r.avgHr != null ? `${r.avgHr}${zone ? ` · Z${zone.zone}` : ''}` : '—'} accent="bg-hr" />
          </dl>
        </div>
      </Link>
    </Card>
  )
}
