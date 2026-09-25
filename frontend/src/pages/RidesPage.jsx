import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useApp } from '../context/AppContext'
import { useActivities } from '../lib/useActivities'
import { useApiQuery } from '../lib/useApiQuery'
import { api } from '../lib/api'
import { formatNumber } from '../lib/format'
import { STRAVA_RESULT } from '../lib/strava'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { FormError } from '../components/ui/Field'
import { PageHeader } from '../components/PageHeader'
import { RideCard } from '../components/RideCard'
import { RouteFilters } from '../components/RouteFilters'
import { EMPTY_FILTERS, filtersToQuery, hasActiveFilters } from '../lib/routeFilters'
import { StravaControls } from '../components/StravaControls'

export function RidesPage() {
  const { refreshKey, openNewActivity, toast } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const query = useMemo(() => filtersToQuery(filters), [filters])
  const { page, loading, error, loadMore } = useActivities(query, refreshKey)
  const [loadingMore, setLoadingMore] = useState(false)

  // Resultado de la vuelta desde Strava (?strava=connected|denied|…), mostrado una sola vez
  const handledResult = useRef(null)
  useEffect(() => {
    const result = searchParams.get('strava')
    if (!result || handledResult.current === result) return
    handledResult.current = result
    const [message, tone] = STRAVA_RESULT[result] ?? STRAVA_RESULT.error
    toast(message, tone)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams, toast])

  // Límites de zonas para etiquetar la FC de cada salida
  const zones = useApiQuery(() => api('/stats/hr-zones'), [refreshKey]).data?.zones ?? null

  async function handleLoadMore() {
    setLoadingMore(true)
    try {
      await loadMore()
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <PageHeader
        title="Salidas"
        description={page ? `${formatNumber(page.total)} ${page.total === 1 ? 'salida realizada' : 'salidas realizadas'}${hasActiveFilters(filters) ? ' con estos filtros' : ''}` : 'Lo que ya has rodado'}
        action={
          <>
            <Button variant="ghost" onClick={() => openNewActivity('manual')}>Añadir manual</Button>
            <Button variant="secondary" onClick={() => openNewActivity('gpx')}>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
              Subir GPX
            </Button>
            <StravaControls />
          </>
        }
      />

      <RouteFilters filters={filters} onChange={setFilters} />
      <FormError>{error}</FormError>

      {!page ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Cargando rutas">
          {[0, 1, 2].map((i) => <Card as="li" key={i} className="h-80 animate-pulse" />)}
        </ul>
      ) : page.data.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-5 py-16 text-center">
          <p className="text-sm text-zinc-400">
            {!hasActiveFilters(filters) ? 'Aún no tienes salidas registradas.' : 'Ninguna salida coincide con estos filtros.'}
          </p>
          {!hasActiveFilters(filters)
            ? <Button variant="secondary" size="sm" onClick={() => openNewActivity('gpx')}>Subir un GPX</Button>
            : <Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>Limpiar filtros</Button>}
        </Card>
      ) : (
        <>
          <ul className={`stagger grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${loading ? 'opacity-50' : ''}`}>
            {page.data.map((ride, i) => <RideCard key={ride.id} ride={ride} zones={zones} index={i} />)}
          </ul>
          {page.data.length < page.total && (
            <div className="flex justify-center">
              <Button variant="secondary" size="sm" onClick={handleLoadMore} loading={loadingMore}>
                Ver más ({page.total - page.data.length})
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
