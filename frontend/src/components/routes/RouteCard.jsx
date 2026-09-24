import { useState } from 'react'
import { Link } from 'react-router'
import { Card } from '../ui/Card'
import { RoutePreview } from '../RoutePreview'
import { Chip } from '../RideCard'
import { formatDate, formatDuration, formatNumber } from '../../lib/format'
import { ROUTING_OPTIONS } from '../../lib/planner'

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

// Tarjeta de ruta planificada: el enlace abre el editor; acciones de descarga y borrado aparte
export function RouteCard({ route: r, avgSpeed, onDownload, onDelete, downloading, index = 0 }) {
  const [confirming, setConfirming] = useState(false)
  const eta = avgSpeed ? Math.round((r.distanceKm / avgSpeed) * 60) : null

  function handleDelete() {
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
      return
    }
    onDelete(r.id)
  }

  return (
    <Card as="li" style={{ '--i': index % 12 }}
      className="group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_24px_48px_-24px_rgb(59_130_246/0.55)]">
      <Link to={`/rutas/${r.id}`} className="flex flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-series/60">
        <div className="relative h-32 border-b border-zinc-800 bg-zinc-950/60 bg-[linear-gradient(rgb(39_39_42/0.35)_1px,transparent_1px),linear-gradient(90deg,rgb(39_39_42/0.35)_1px,transparent_1px)] bg-[size:16px_16px]">
          <RoutePreview segments={r.preview} width={320} height={128} padding={14} markers
            className="size-full transition-transform duration-300 group-hover:scale-[1.03]" />
          <div className="absolute top-3 left-3 flex gap-1.5">
            <Chip>{ROUTING_OPTIONS.find((o) => o.value === r.routing)?.label ?? 'Ruta'}</Chip>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wider text-zinc-400 uppercase">Actualizada {formatDate(r.updatedAt)}</p>
            <h3 className="mt-1 truncate text-base font-medium text-zinc-100" title={r.name}>{r.name}</h3>
          </div>
          <p className="text-3xl font-semibold tracking-tight text-zinc-100">
            {formatNumber(r.distanceKm, 1)}{' '}
            <span className="ml-0.5 text-base font-normal tracking-normal text-zinc-400">km</span>
          </p>
          <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4">
            <Stat label="Desnivel" value={r.elevationGain != null ? `${formatNumber(r.elevationGain)} m` : '—'} accent="bg-elev" />
            <Stat label="Tiempo est." value={eta ? formatDuration(eta) : '—'} accent="bg-dist" />
          </dl>
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 border-t border-zinc-800 px-3 py-2">
        <button type="button" onClick={() => onDownload(r.id)} disabled={downloading}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50">
          {downloading ? 'Descargando…' : 'Descargar GPX'}
        </button>
        <button type="button" onClick={handleDelete} aria-label={confirming ? `Confirmar borrado de ${r.name}` : `Borrar ${r.name}`}
          className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors
            ${confirming ? 'bg-critical/10 text-critical' : 'text-zinc-500 hover:bg-critical/10 hover:text-critical'}`}>
          {confirming ? '¿Borrar?' : 'Borrar'}
        </button>
      </div>
    </Card>
  )
}
