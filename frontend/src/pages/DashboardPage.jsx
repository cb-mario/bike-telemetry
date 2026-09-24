import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDashboardData } from '../lib/useDashboardData'
import { RANGES } from '../lib/ranges'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { FormError } from '../components/ui/Field'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Logo } from '../components/Logo'
import { StatTiles } from '../components/StatTiles'
import { EvolutionChart } from '../components/EvolutionChart'
import { HrZonesCard } from '../components/HrZonesCard'
import { ActivityTable } from '../components/ActivityTable'
import { ActivityForm } from '../components/ActivityForm'

export function DashboardPage() {
  const { user, logout } = useAuth()
  const [range, setRange] = useState('12w')
  const [refreshKey, setRefreshKey] = useState(0)
  const [creating, setCreating] = useState(false)
  const { data, loading, error, loadMoreActivities } = useDashboardData(range, refreshKey)

  const refresh = () => setRefreshKey((k) => k + 1)

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-ink-muted sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={logout}>Salir</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tu rendimiento</h1>
            <p className="mt-1 text-sm text-ink-muted">Métricas de tus salidas en bici</p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <span aria-hidden className="text-base leading-none">+</span> Nueva salida
          </Button>
        </div>

        {/* Filtro único: afecta a todo lo que hay debajo */}
        <div className="self-start">
          <SegmentedControl label="Periodo" options={RANGES} value={range} onChange={setRange} />
        </div>

        <FormError>{error}</FormError>

        {data && (
          <>
            <div className={`transition-opacity ${loading ? 'opacity-50' : ''}`}>
              <StatTiles summary={data.summary} />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="min-w-0 lg:col-span-2">
                <EvolutionChart evolution={data.evolution} loading={loading} />
              </div>
              <HrZonesCard zones={data.zones} loading={loading} onProfileChange={refresh} />
            </div>
            <ActivityTable activities={data.activities} loading={loading}
              onChanged={refresh} onLoadMore={loadMoreActivities} onCreate={() => setCreating(true)} />
          </>
        )}
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
