import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Polyline, Tooltip } from 'react-leaflet'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { formatDate, formatNumber } from '../lib/format'
import { sportLabel } from '../lib/sportTypes'
import { BaseMap } from '../components/map/BaseMap'
import { boundsOf } from '../lib/geo'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Label } from '../components/ui/Text'
import { DATE_FILTERS } from '../lib/routeFilters'

const PERIODS = [
  { value: '', label: 'Todo' },
  { value: 'year', label: 'Este año' },
  { value: '90d', label: '3 meses' },
]

// Azul eléctrico semitransparente: donde se solapan rutas, la línea se intensifica
const ROUTE = { color: '#3987e5', weight: 2.5, opacity: 0.7 }
const GLOW = { color: '#3987e5', weight: 9, opacity: 0.12 }
const ACTIVE = { color: '#f4f4f5', weight: 4, opacity: 1 }

export function ExplorerPage() {
  const { refreshKey } = useApp()
  const navigate = useNavigate()
  const [period, setPeriod] = useState('')
  const [routes, setRoutes] = useState(null)
  const [error, setError] = useState('')
  const [active, setActive] = useState(null)

  useEffect(() => {
    let cancelled = false
    const from = DATE_FILTERS.find((f) => f.value === period)?.from?.()
    api('/activities/routes', { query: { from } })
      .then((r) => !cancelled && (setRoutes(r), setError('')))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [period, refreshKey])

  // Las salidas virtuales (Zwift…) están en mundos ficticios: se dibujan pero no cuentan para encuadrar
  const bounds = useMemo(() => {
    if (!routes?.length) return null
    const real = routes.filter((r) => r.sportType !== 'VirtualRide')
    return boundsOf((real.length ? real : routes).flatMap((r) => r.segments.flat()))
  }, [routes])

  const totalKm = routes?.reduce((sum, r) => sum + r.distanceKm, 0) ?? 0
  const activeRoute = routes?.find((r) => r.id === active)

  return (
    <main className="relative h-[calc(100svh-3.5rem-4.5rem)] sm:h-[calc(100svh-3.5rem)]">
      <BaseMap bounds={bounds} padding={48} className="size-full">
        {routes?.map((r) => (
          <Polyline key={`glow-${r.id}`} positions={r.segments} pathOptions={GLOW} interactive={false} />
        ))}
        {routes?.map((r) => (
          <Polyline key={r.id} positions={r.segments} pathOptions={r.id === active ? ACTIVE : ROUTE}
            eventHandlers={{
              mouseover: (e) => { setActive(r.id); e.target.bringToFront() },
              mouseout: () => setActive(null),
              click: () => navigate(`/rutas/${r.id}`),
            }}>
            <Tooltip sticky className="route-tooltip" direction="top" offset={[0, -8]}>
              <p className="text-sm font-semibold">{formatNumber(r.distanceKm, 1)} km</p>
              <p className="text-xs text-zinc-300">{r.title}</p>
              <p className="text-xs text-zinc-500">{formatDate(r.date)} · {sportLabel(r.sportType)}</p>
            </Tooltip>
          </Polyline>
        ))}
      </BaseMap>

      {/* Panel flotante */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex justify-start sm:inset-x-auto sm:left-4 sm:top-4">
        <div className="pointer-events-auto w-full rounded-2xl border border-zinc-800 bg-zinc-900/75 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:w-80">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-sm font-semibold text-zinc-100">Explorador</h1>
            <SegmentedControl label="Periodo" options={PERIODS} value={period} onChange={setPeriod} />
          </div>
          {error ? (
            <p role="alert" className="mt-3 text-xs text-zinc-300"><span aria-hidden className="text-critical">● </span>{error}</p>
          ) : (
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <Label as="dt">Rutas</Label>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">{routes ? formatNumber(routes.length) : '—'}</dd>
              </div>
              <div>
                <Label as="dt">Distancia</Label>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">
                  {routes ? formatNumber(totalKm) : '—'}<span className="ml-1 text-sm font-normal text-zinc-400">km</span>
                </dd>
              </div>
            </dl>
          )}
          <p className="mt-3 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
            {activeRoute
              ? <><span className="font-medium text-zinc-200">{activeRoute.title}</span> · pulsa para ver el detalle</>
              : routes?.length === 0 ? 'Aún no hay rutas con recorrido GPS. Sube un GPX o sincroniza Strava.'
                : 'Toca o pasa por encima de una ruta para ver su detalle.'}
          </p>
        </div>
      </div>
    </main>
  )
}
