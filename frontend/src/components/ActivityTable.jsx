import { useState } from 'react'
import { Card, CardHeader } from './ui/Card'
import { Button } from './ui/Button'
import { api } from '../lib/api'
import { formatDate, formatDuration, formatKm, formatNumber } from '../lib/format'

export function ActivityTable({ activities, loading, onChanged, onLoadMore, onCreate }) {
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
    <Card>
      <CardHeader title="Salidas" description={`${total} en este periodo`} />
      <div className={`px-5 pt-3 pb-5 transition-opacity ${loading ? 'opacity-50' : ''}`}>
        {data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-ink-muted">No hay salidas en este periodo.</p>
            <Button variant="secondary" size="sm" onClick={onCreate}>Registrar una salida</Button>
          </div>
        ) : (
          <div className="relative -mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[36rem] text-left text-sm tabular-nums">
              <thead className="text-xs text-ink-muted">
                <tr className="border-b border-zinc-800">
                  <th className="py-2.5 pr-4 font-medium">Salida</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Distancia</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Tiempo</th>
                  <th className="hidden py-2.5 pr-4 text-right font-medium md:table-cell">Vel. media</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Desnivel</th>
                  <th className="hidden py-2.5 pr-4 text-right font-medium sm:table-cell">FC media / máx.</th>
                  <th className="w-px py-2.5"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {data.map((a) => <Row key={a.id} activity={a} onDeleted={onChanged} />)}
              </tbody>
            </table>
          </div>
        )}
        {data.length < total && (
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Cargando…' : `Ver más (${total - data.length})`}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

function Row({ activity: a, onDeleted }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const speed = a.distanceKm / (a.durationMin / 60)

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
      return
    }
    setDeleting(true)
    try {
      await api(`/activities/${a.id}`, { method: 'DELETE' })
      onDeleted()
    } catch {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <tr className={`border-b border-zinc-900 transition-colors hover:bg-zinc-900/50 ${deleting ? 'opacity-40' : ''}`}>
      <td className="max-w-64 py-3 pr-4">
        <p className="truncate font-medium text-ink">{a.title}</p>
        <p className="truncate text-xs text-ink-muted">
          {formatDate(a.date)}{a.notes && ` · ${a.notes}`}
        </p>
      </td>
      <td className="py-3 pr-4 text-right text-ink">{formatKm(a.distanceKm)}</td>
      <td className="py-3 pr-4 text-right text-ink-secondary">{formatDuration(a.durationMin)}</td>
      <td className="hidden py-3 pr-4 text-right text-ink-secondary md:table-cell">{formatNumber(speed, 1)} km/h</td>
      <td className="py-3 pr-4 text-right text-ink-secondary">
        {a.elevationGain != null ? `${formatNumber(a.elevationGain)} m` : '—'}
      </td>
      <td className="hidden py-3 pr-4 text-right text-ink-secondary sm:table-cell">
        {a.avgHr ?? '—'} / {a.maxHr ?? '—'}
      </td>
      <td className="py-3 text-right">
        <Button variant={confirming ? 'danger' : 'ghost'} size="sm" onClick={handleDelete} disabled={deleting}
          aria-label={confirming ? `Confirmar borrado de ${a.title}` : `Borrar ${a.title}`}>
          {confirming ? '¿Borrar?' : 'Borrar'}
        </Button>
      </td>
    </tr>
  )
}
