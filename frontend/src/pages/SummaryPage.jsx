import { useState } from 'react'
import { Link } from 'react-router'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { formatDuration, formatNumber, formatWeekdayDate } from '../lib/format'
import { SOURCE_LABEL, sportLabel } from '../lib/sportTypes'
import { ROUTING_OPTIONS } from '../lib/planner'
import { zoneFor } from '../lib/zones'
import { RoutePreview } from '../components/RoutePreview'
import { useDashboardData } from '../lib/useDashboardData'
import { useOverview } from '../lib/useOverview'
import { useApiQuery } from '../lib/useApiQuery'
import { RANGES } from '../lib/ranges'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { FormError } from '../components/ui/Field'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { MonthPanel, PanelSkeleton, Reading, TotalsPanel } from '../components/OverviewCards'
import { Chip } from '../components/RideCard'
import { EvolutionChart } from '../components/EvolutionChart'
import { HrZonesCard } from '../components/HrZonesCard'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/ui/Icon'

export function SummaryPage() {
  const { refreshKey, refresh, openNewActivity } = useApp()
  const [range, setRange] = useState('12w')
  const overview = useOverview(refreshKey)
  const { data, loading, error } = useDashboardData(range, refreshKey)
  const { last, next } = useLatest(refreshKey)

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <PageHeader title="Resumen" description="Tu rendimiento de un vistazo"
        action={(
          <Button onClick={() => openNewActivity('gpx')}>
            <Icon name="plus" className="size-4" />
            Nueva salida
          </Button>
        )} />

      {/* Bento: la última salida manda (mapa grande); al lado, el mes con su tendencia y la próxima ruta */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 lg:col-span-2 lg:row-span-2">
          {last === undefined
            ? <PanelSkeleton className="min-h-[420px] w-full" />
            : <LastRide ride={last} zones={data?.zones?.zones} onImport={() => openNewActivity('gpx')} />}
        </div>
        <MonthPanel overview={overview} />
        {next === undefined ? <PanelSkeleton className="h-[200px]" /> : <NextRoute route={next} />}
      </div>

      <TotalsPanel overview={overview} />

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

// Última salida y ruta planificada más reciente (undefined mientras cargan, null si no hay)
function useLatest(refreshKey) {
  const last = useApiQuery(() => api('/activities', { query: { limit: 1 } }).then((r) => r.data[0] ?? null), ['last', refreshKey])
  const next = useApiQuery(() => api('/planned-routes', { query: { limit: 1 } }).then((r) => r[0] ?? null), ['next', refreshKey])
  // Un error cuenta como "no hay" para no dejar la tarjeta cargando
  const settle = (q) => (q.error ? null : q.data)
  return { last: settle(last), next: settle(next) }
}

// Trazado grande sobre el fondo del panel; sin GPS, solo inicio y final unidos por una discontinua
function MapArea({ segments, width, height, className = '' }) {
  return (
    <div className={`relative flex items-center justify-center bg-zinc-950/60 ${className}`}>
      {segments ? (
        <RoutePreview segments={segments} width={width} height={height} padding={28} markers strokeWidth={3}
          className="absolute inset-0 size-full" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-xs text-zinc-500">
          <svg viewBox="0 0 96 12" className="h-3 w-24" aria-hidden>
            <path d="M6 6h84" className="stroke-zinc-700" strokeWidth="1.5" strokeDasharray="3 4" strokeLinecap="round" />
            <circle cx="6" cy="6" r="3" className="fill-zinc-600" />
            <circle cx="90" cy="6" r="3" className="fill-zinc-600" />
          </svg>
          Sin recorrido GPS
        </div>
      )}
    </div>
  )
}

function LastRide({ ride: r, zones, onImport }) {
  if (!r) {
    return (
      <Card className="flex w-full flex-col items-start justify-end gap-4 p-6 sm:p-8">
        <div className="max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">Aún no hay salidas</h2>
          <p className="mt-2 text-sm text-zinc-400">Sube un GPX o sincroniza Strava y aquí verás tu última salida con su recorrido.</p>
        </div>
        <Button onClick={onImport}>
          <Icon name="upload" className="size-4" />
          Importar un GPX
        </Button>
      </Card>
    )
  }

  const zone = zoneFor(r.avgHr, zones)
  const hasTrack = Boolean(r.routePreview)
  const size = hasTrack ? 'text-2xl' : 'text-3xl sm:text-4xl'
  return (
    <Card as={Link} to={`/salidas/${r.id}`}
      className="group flex w-full flex-col overflow-hidden transition-colors duration-150 hover:border-zinc-600 focus-visible:outline-2 focus-visible:outline-brand-2">
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <p className="text-xs text-zinc-400 first-letter:uppercase">Última salida · {formatWeekdayDate(r.date)}</p>
          <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight text-zinc-100 group-hover:text-white" title={r.title}>{r.title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Chip>{sportLabel(r.sportType)}</Chip>
          <Chip dot={r.source === 'strava' ? 'bg-strava' : undefined}>{SOURCE_LABEL[r.source] ?? 'Manual'}</Chip>
          <Icon name="chevronRight" className="ml-1 size-4 text-zinc-500 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-zinc-200" />
        </div>
      </div>
      {/* Con recorrido, el mapa ocupa el espacio; sin él, las cifras crecen para llenarlo */}
      {hasTrack && <MapArea segments={r.routePreview} width={720} height={300} className="min-h-56 flex-1 border-y border-zinc-800" />}
      <div className={hasTrack
        ? 'grid grid-cols-2 gap-px bg-zinc-800 sm:grid-cols-4'
        : 'grid flex-1 grid-cols-2 gap-px border-t border-zinc-800 bg-zinc-800'}>
        <Reading accent="dist" label="Distancia" size={size} value={formatNumber(r.distanceKm, 1)} unit="km"
          sub={hasTrack ? undefined : 'Salida sin recorrido GPS'} />
        <Reading label="Tiempo" size={size} value={formatDuration(r.durationMin)} />
        <Reading accent="elev" label="Desnivel" size={size}
          value={formatNumber(r.elevationGain)} unit={r.elevationGain != null ? 'm' : undefined} />
        <Reading accent="hr" label="FC media" size={size}
          value={formatNumber(r.avgHr)} unit={r.avgHr != null ? 'bpm' : undefined}
          sub={zone ? `Zona ${zone.zone} · ${zone.name}` : undefined} />
      </div>
    </Card>
  )
}

function NextRoute({ route: r }) {
  if (!r) {
    return (
      <Card as={Link} to="/rutas/nueva"
        className="group flex flex-col justify-between gap-6 p-5 transition-colors duration-150 hover:border-zinc-600 focus-visible:outline-2 focus-visible:outline-brand-2">
        <span className="flex size-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/60 text-zinc-300">
          <Icon name="map" className="size-[18px]" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Planifica tu próxima ruta</h2>
          <p className="mt-1 text-sm text-zinc-400">Dibújala en el mapa y llévala al ciclocomputador.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card as={Link} to={`/rutas/${r.id}`}
      className="group flex flex-col overflow-hidden transition-colors duration-150 hover:border-zinc-600 focus-visible:outline-2 focus-visible:outline-brand-2">
      <MapArea segments={r.preview} width={360} height={128} className="h-32 border-b border-zinc-800" />
      <div className="flex items-end justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs text-zinc-400">
            Próxima ruta · {ROUTING_OPTIONS.find((o) => o.value === r.routing)?.label ?? 'Ruta'}
          </p>
          <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-zinc-100 group-hover:text-white" title={r.name}>{r.name}</h2>
        </div>
        <p className="shrink-0 font-display text-lg font-semibold text-zinc-100 tabular-nums">
          {formatNumber(r.distanceKm, 1)}<span className="ml-1 text-sm font-normal text-zinc-400">km</span>
          {r.elevationGain != null && (
            <>
              <span className="mx-2 text-zinc-600" aria-hidden>·</span>
              {formatNumber(r.elevationGain)}<span className="ml-1 text-sm font-normal text-zinc-400">m</span>
            </>
          )}
        </p>
      </div>
    </Card>
  )
}
