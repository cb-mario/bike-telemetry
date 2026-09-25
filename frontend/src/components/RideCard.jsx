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
      className="group overflow-hidden transition-colors duration-150 hover:border-zinc-600">
      <Link to={`/salidas/${r.id}`} className="flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-brand-2/60">
        {r.routePreview ? (
          // Miniatura del trazado con las fichas encima
          <div className="relative h-44 border-b border-zinc-800 bg-zinc-950/50">
            <RoutePreview segments={r.routePreview} width={320} height={176} padding={18} markers strokeWidth={2.5}
              className="size-full" />
            <div className="absolute top-3 left-3 flex gap-1.5">
              <Chip>{sportLabel(r.sportType)}</Chip>
              <Chip dot={r.source === 'strava' ? 'bg-strava' : undefined}>{SOURCE_LABEL[r.source] ?? 'Manual'}</Chip>
            </div>
          </div>
        ) : (
          // Sin trazado, la distancia ocupa el sitio del mapa: las tarjetas mantienen su altura sin huecos vacíos
          <div className="relative flex h-44 flex-col justify-end border-b border-zinc-800 bg-zinc-950/50 px-5 pb-4">
            <div className="absolute top-3 right-3 left-3 flex items-center justify-between gap-3">
              <div className="flex gap-1.5">
                <Chip>{sportLabel(r.sportType)}</Chip>
                <Chip dot={r.source === 'strava' ? 'bg-strava' : undefined}>{SOURCE_LABEL[r.source] ?? 'Manual'}</Chip>
              </div>
              <span className="text-[11px] text-zinc-500">Sin GPS</span>
            </div>
            <p className="font-display text-5xl font-semibold tracking-tight text-zinc-100 tabular-nums">
              {formatNumber(r.distanceKm, 1)}
              <span className="ml-1.5 text-lg font-normal tracking-normal text-zinc-400">km</span>
            </p>
          </div>
        )}

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="min-w-0">
            <h3 className="truncate text-base font-medium text-zinc-100 group-hover:text-white" title={r.title}>{r.title}</h3>
            <p className="mt-0.5 text-sm text-zinc-400 first-letter:uppercase">{formatWeekdayDate(r.date)}</p>
          </div>
          {r.routePreview && (
          <p className="font-display text-3xl font-semibold tracking-tight text-zinc-100 tabular-nums">
            {formatNumber(r.distanceKm, 1)}{' '}
            <span className="ml-0.5 text-base font-normal tracking-normal text-zinc-400">km</span>
          </p>
          )}
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
