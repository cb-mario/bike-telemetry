import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { formatNumber, formatWeekdayDate } from '../lib/format'
import { RoutePreview } from '../components/RoutePreview'
import { useDashboardData } from '../lib/useDashboardData'
import { useOverview } from '../lib/useOverview'
import { RANGES } from '../lib/ranges'
import { Card } from '../components/ui/Card'
import { FormError } from '../components/ui/Field'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { OverviewCards } from '../components/OverviewCards'
import { EvolutionChart } from '../components/EvolutionChart'
import { HrZonesCard } from '../components/HrZonesCard'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/ui/Icon'

export function SummaryPage() {
  const { refreshKey, refresh } = useApp()
  const [range, setRange] = useState('12w')
  const overview = useOverview(refreshKey)
  const { data, loading, error } = useDashboardData(range, refreshKey)

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <PageHeader title="Resumen" description="Tu rendimiento de un vistazo" />

      {/* KPIs globales: todo el historial y el mes en curso */}
      <OverviewCards overview={overview} />
      <Shortcuts refreshKey={refreshKey} />

      <div className="flex flex-col gap-6">
        {/* Filtro único: afecta a todo lo que hay debajo */}
        <div className="self-start">
          <SegmentedControl label="Periodo" options={RANGES} value={range} onChange={setRange} />
        </div>
        <FormError>{error}</FormError>
        {data ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col lg:col-span-2">
              <EvolutionChart evolution={data.evolution} summary={data.summary} loading={loading} />
            </div>
            <HrZonesCard zones={data.zones} loading={loading} onProfileChange={refresh} />
          </div>
        ) : !error && (
          <div className="grid gap-6 lg:grid-cols-3" aria-busy="true" aria-label="Cargando métricas">
            <Card as="div" className="h-[480px] animate-pulse lg:col-span-2" />
            <Card as="div" className="h-[480px] animate-pulse" />
          </div>
        )}
      </div>
    </main>
  )
}

// Accesos a lo último que has rodado y a la ruta planificada más reciente
function Shortcuts({ refreshKey }) {
  const [last, setLast] = useState(undefined)
  const [next, setNext] = useState(undefined)

  useEffect(() => {
    api('/activities', { query: { limit: 1 } }).then((r) => setLast(r.data[0] ?? null)).catch(() => setLast(null))
    api('/planned-routes').then((r) => setNext(r[0] ?? null)).catch(() => setNext(null))
  }, [refreshKey])

  if (last === undefined || next === undefined) return null
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ShortcutCard to={last ? `/salidas/${last.id}` : '/salidas'} kind="Última salida"
        title={last?.title ?? 'Aún no hay salidas'}
        meta={last ? `${formatWeekdayDate(last.date)} · ${formatNumber(last.distanceKm, 1)} km` : 'Sube un GPX o sincroniza Strava'}
        preview={last?.routePreview} />
      <ShortcutCard to={next ? `/rutas/${next.id}` : '/rutas/nueva'} kind="Próxima ruta"
        title={next?.name ?? 'Planifica tu próxima ruta'}
        meta={next ? `${formatNumber(next.distanceKm, 1)} km${next.elevationGain != null ? ` · ${formatNumber(next.elevationGain)} m` : ''}` : 'Dibújala en el mapa y llévala al ciclocomputador'}
        preview={next?.preview} />
    </div>
  )
}

// El tipo de acceso va en la línea de detalle, no como antetítulo
function ShortcutCard({ to, kind, title, meta, preview }) {
  return (
    <Link to={to} className="group flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3 pr-4 transition-colors duration-150 hover:border-zinc-600 focus-visible:outline-2 focus-visible:outline-brand-2">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/60 text-zinc-500">
        {preview ? <RoutePreview segments={preview} width={56} height={56} padding={8} /> : <Icon name="plus" className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-100">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-zinc-400">
          <span className="text-zinc-300">{kind}</span> · {meta}
        </span>
      </span>
      <Icon name="chevronRight" className="size-4 shrink-0 text-zinc-500 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-zinc-200" />
    </Link>
  )
}
