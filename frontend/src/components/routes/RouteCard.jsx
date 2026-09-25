import { useState } from 'react'
import { Link } from 'react-router'
import { Card } from '../ui/Card'
import { RoutePreview } from '../RoutePreview'
import { Chip } from '../RideCard'
import { formatDate, formatDuration, formatNumber } from '../../lib/format'
import { ROUTING_OPTIONS } from '../../lib/planner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

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
  const [deleting, setDeleting] = useState(false)
  const eta = avgSpeed ? Math.round((r.distanceKm / avgSpeed) * 60) : null

  // Si el borrado va bien la tarjeta desaparece; si falla, el diálogo sigue abierto para reintentar
  async function confirmDelete() {
    setDeleting(true)
    await onDelete(r.id)
    setDeleting(false)
  }

  return (
    <Card as="li" style={{ '--i': index % 12 }}
      className="group flex flex-col overflow-hidden transition-colors duration-150 hover:border-zinc-600">
      <Link to={`/rutas/${r.id}`} className="flex flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-brand-2/60">
        <div className="relative h-44 border-b border-zinc-800 bg-zinc-950/50">
          <RoutePreview segments={r.preview} width={320} height={176} padding={18} markers strokeWidth={2.5}
            className="size-full" />
          <div className="absolute top-3 left-3 flex gap-1.5">
            <Chip>{ROUTING_OPTIONS.find((o) => o.value === r.routing)?.label ?? 'Ruta'}</Chip>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="min-w-0">
            <h3 className="truncate text-base font-medium text-zinc-100 group-hover:text-white" title={r.name}>{r.name}</h3>
            <p className="mt-0.5 text-sm text-zinc-400">Actualizada el {formatDate(r.updatedAt)}</p>
          </div>
          <p className="font-display text-3xl font-semibold tracking-tight text-zinc-100 tabular-nums">
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
        <AlertDialog>
          <AlertDialogTrigger aria-label={`Borrar ${r.name}`}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-critical/10 hover:text-critical">
            Borrar
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Borrar «{r.name}»?</AlertDialogTitle>
              <AlertDialogDescription>
                La ruta desaparece de tu biblioteca. Los GPX que ya hayas descargado no se ven afectados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={confirmDelete} loading={deleting}>Borrar ruta</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  )
}
