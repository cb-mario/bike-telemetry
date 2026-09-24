import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDashboardData } from '../lib/useDashboardData'
import { useOverview } from '../lib/useOverview'
import { RANGES } from '../lib/ranges'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Dialog } from '../components/ui/Dialog'
import { FormError } from '../components/ui/Field'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Logo } from '../components/Logo'
import { OverviewCards } from '../components/OverviewCards'
import { EvolutionChart } from '../components/EvolutionChart'
import { HrZonesCard } from '../components/HrZonesCard'
import { RideGrid } from '../components/RideGrid'
import { ActivityForm } from '../components/ActivityForm'

export function DashboardPage() {
  const { user, logout } = useAuth()
  const [range, setRange] = useState('12w')
  const [refreshKey, setRefreshKey] = useState(0)
  const [creating, setCreating] = useState(false)
  const overview = useOverview(refreshKey)
  const { data, loading, error, loadMoreActivities } = useDashboardData(range, refreshKey)

  const refresh = () => setRefreshKey((k) => k + 1)

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-surface/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-zinc-500 sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={logout}>Salir</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">Tu rendimiento</h1>
            <p className="mt-1.5 text-sm text-zinc-400">Métricas de tus salidas en bici</p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <span aria-hidden className="text-base leading-none">+</span> Nueva salida
          </Button>
        </div>

        {/* Resumen global: no depende del filtro de periodo */}
        <OverviewCards overview={overview} />

        <div className="flex flex-col gap-6">
          {/* Filtro único: afecta a todo lo que hay debajo */}
          <div className="self-start">
            <SegmentedControl label="Periodo" options={RANGES} value={range} onChange={setRange} />
          </div>

          <FormError>{error}</FormError>

          {data ? (
            <>
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col lg:col-span-2">
                  <EvolutionChart evolution={data.evolution} summary={data.summary} loading={loading} />
                </div>
                <HrZonesCard zones={data.zones} loading={loading} onProfileChange={refresh} />
              </div>
              <RideGrid activities={data.activities} zones={data.zones.zones} loading={loading}
                onChanged={refresh} onLoadMore={loadMoreActivities} onCreate={() => setCreating(true)} />
            </>
          ) : (
            !error && <DashboardSkeleton />
          )}
        </div>
      </main>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Nueva salida"
        description="Registra los datos de tu entrenamiento.">
        <ActivityForm
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            refresh()
          }}
        />
      </Dialog>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3" aria-busy="true" aria-label="Cargando métricas">
      <Card as="div" className="h-[480px] animate-pulse lg:col-span-2" />
      <Card as="div" className="h-[480px] animate-pulse" />
    </div>
  )
}
