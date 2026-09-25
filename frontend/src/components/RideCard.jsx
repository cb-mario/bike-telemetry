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
        {/* Miniatura del trazado */}
        <div className="relative h-32 border-b border-zinc-800 bg-zinc-950/50">
          {r.routePreview ? (
            <RoutePreview segments={r.routePreview} width={320} height={128} padding={14} markers
              className="size-full" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-xs text-zinc-500">
              {/* Sin trazado: solo inicio y final, unidos por una línea discontinua */}
              <svg viewBox="0 0 96 12" className="h-3 w-24" aria-hidden>
                <path d="M6 6h84" className="stroke-zinc-700" strokeWidth="1.5" strokeDasharray="3 4" strokeLinecap="round" />
                <circle cx="6" cy="6" r="3" className="fill-zinc-600" />
                <circle cx="90" cy="6" r="3" className="fill-zinc-600" />
              </svg>
              Sin recorrido GPS
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-1.5">
            <Chip>{sportLabel(r.sportType)}</Chip>
            <Chip dot={r.source === 'strava' ? 'bg-strava' : undefined}>{SOURCE_LABEL[r.source] ?? 'Manual'}</Chip>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="min-w-0">
            <h3 className="truncate text-base font-medium text-zinc-100 group-hover:text-white" title={r.title}>{r.title}</h3>
            <p className="mt-0.5 text-sm text-zinc-400 first-letter:uppercase">{formatWeekdayDate(r.date)}</p>
          </div>
          <p className="text-3xl font-semibold tracking-tight text-zinc-100 tabular-nums">
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
