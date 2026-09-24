import { formatNumber } from '../../lib/format'
import { ROUTING_OPTIONS } from '../../lib/planner'
import { RoutePreview } from '../RoutePreview'
import { Label } from '../ui/Text'

export function SavedRoutes({ routes, activeId, onOpen, onDownload, onDelete, busyId }) {
  if (!routes) return <div className="h-16 animate-pulse rounded-xl bg-zinc-800/40" />
  if (!routes.length) {
    return <p className="text-xs text-zinc-500">Aún no has guardado rutas.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {routes.map((r) => (
        <li key={r.id}
          className={`group flex items-center gap-3 rounded-xl border p-2 pr-3 transition-colors duration-200
            ${r.id === activeId ? 'border-series/60 bg-series/10' : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'}`}>
          <button type="button" onClick={() => onOpen(r.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="shrink-0 rounded-lg bg-zinc-900">
              <RoutePreview segments={r.preview} width={52} height={40} padding={4} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-zinc-100">{r.name}</span>
              <span className="block text-xs text-zinc-500">
                {formatNumber(r.distanceKm, 1)} km
                {r.elevationGain != null && ` · ${formatNumber(r.elevationGain)} m`}
                {' · '}{ROUTING_OPTIONS.find((o) => o.value === r.routing)?.label}
              </span>
            </span>
          </button>
          <button type="button" onClick={() => onDownload(r.id)} disabled={busyId === r.id}
            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
            aria-label={`Descargar GPX de ${r.name}`}>GPX</button>
          <button type="button" onClick={() => onDelete(r.id)}
            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-critical/10 hover:text-critical"
            aria-label={`Borrar ${r.name}`}>✕</button>
        </li>
      ))}
    </ul>
  )
}

export function PanelSection({ title, children, action }) {
  return (
    <section className="flex flex-col gap-3 border-t border-zinc-800 pt-4">
      <div className="flex items-center justify-between">
        <Label as="h2">{title}</Label>
        {action}
      </div>
      {children}
    </section>
  )
}
