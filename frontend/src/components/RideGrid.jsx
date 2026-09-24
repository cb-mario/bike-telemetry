import { useEffect, useRef, useState } from 'react'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Label } from './ui/Text'
import { api } from '../lib/api'
import { formatDuration, formatNumber, formatWeekdayDate } from '../lib/format'
import { ZONE_BG, zoneFor } from '../lib/zones'
import { RoutePreview } from './RoutePreview'

export function RideGrid({ activities, zones, loading, onChanged, onLoadMore, onCreate }) {
  const [loadingMore, setLoadingMore] = useState(false)
  const { data, total } = activities

  async function loadMore() {
    setLoadingMore(true)
    try {
      await onLoadMore()
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <section aria-labelledby="rides-title">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="rides-title" className="text-sm font-medium text-zinc-100">Salidas</h2>
        <Label as="span">{total === 1 ? '1 en este periodo' : `${formatNumber(total)} en este periodo`}</Label>
      </div>

      {data.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <p className="text-sm text-zinc-400">No hay salidas en este periodo.</p>
          <Button variant="secondary" size="sm" onClick={onCreate}>Registrar una salida</Button>
        </Card>
      ) : (
        <ul className={`grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${loading ? 'opacity-50' : ''}`}>
          {data.map((a) => <RideCard key={a.id} ride={a} zone={zoneFor(a.avgHr, zones)} onDeleted={onChanged} />)}
        </ul>
      )}

      {data.length < total && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" size="sm" onClick={loadMore} loading={loadingMore}>
            Ver más ({total - data.length})
          </Button>
        </div>
      )}
    </section>
  )
}

function ZoneBadge({ zone }) {
  if (!zone) {
    return <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-500">Sin pulso</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/40 px-2 py-0.5 text-[11px] text-zinc-300">
      <span aria-hidden className={`size-1.5 rounded-full ${ZONE_BG[zone.zone - 1]}`} />
      <span className="font-medium text-zinc-100">Z{zone.zone}</span>
      {zone.name}
    </span>
  )
}

function RideCard({ ride: r, zone, onDeleted }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const timer = useRef(null)
  const speed = r.distanceKm / (r.durationMin / 60)

  useEffect(() => () => clearTimeout(timer.current), [])

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true)
      timer.current = setTimeout(() => setConfirming(false), 3000)
      return
    }
    clearTimeout(timer.current)
    setDeleting(true)
    try {
      await api(`/activities/${r.id}`, { method: 'DELETE' })
      onDeleted()
    } catch {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <Card as="li"
      className={`group flex flex-col gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700
        hover:shadow-lg hover:shadow-black/30 ${deleting ? 'opacity-40' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <Label as="span">{formatWeekdayDate(r.date)}</Label>
        <ZoneBadge zone={zone} />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-zinc-100" title={r.title}>{r.title}</h3>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-100">
            {formatNumber(r.distanceKm, 1)}{' '}
            <span className="ml-0.5 text-base font-normal tracking-normal text-zinc-400">km</span>
          </p>
        </div>
        {r.routePreview && (
          <RoutePreview segments={r.routePreview} width={88} height={52} padding={3}
            className="shrink-0 opacity-80 transition-opacity duration-200 group-hover:opacity-100" />
        )}
      </div>

      <dl className="grid grid-cols-3 gap-3 border-t border-zinc-800 pt-4">
        <Stat label="Tiempo" value={formatDuration(r.durationMin)} />
        <Stat label="Vel." value={`${formatNumber(speed, 1)} km/h`} />
        <Stat label="FC" value={r.avgHr != null ? `${r.avgHr} bpm` : '—'} />
      </dl>

      <div className="-mt-1 flex items-center justify-between gap-2">
        <p className="truncate text-xs text-zinc-500">
          {r.elevationGain != null ? `${formatNumber(r.elevationGain)} m de desnivel` : 'Sin desnivel registrado'}
        </p>
        <Button
          variant={confirming ? 'danger' : 'ghost'} size="sm" onClick={handleDelete} loading={deleting}
          className={`-mr-2 transition-opacity ${confirming ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100'}`}
          aria-label={confirming ? `Confirmar borrado de ${r.title}` : `Borrar ${r.title}`}
        >
          {confirming ? '¿Borrar?' : 'Borrar'}
        </Button>
      </div>
    </Card>
  )
}

function Stat({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium tracking-wider text-zinc-400 uppercase">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-zinc-100 tabular-nums">{value}</dd>
    </div>
  )
}
