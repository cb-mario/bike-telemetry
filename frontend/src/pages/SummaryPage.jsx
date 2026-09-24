import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useDashboardData } from '../lib/useDashboardData'
import { useOverview } from '../lib/useOverview'
import { RANGES } from '../lib/ranges'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { FormError } from '../components/ui/Field'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { OverviewCards } from '../components/OverviewCards'
import { EvolutionChart } from '../components/EvolutionChart'
import { HrZonesCard } from '../components/HrZonesCard'
import { PageHeader } from '../components/PageHeader'

export function SummaryPage() {
  const { refreshKey, refresh, openNewActivity } = useApp()
  const [range, setRange] = useState('12w')
  const overview = useOverview(refreshKey)
  const { data, loading, error } = useDashboardData(range, refreshKey)

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <PageHeader title="Resumen" description="Tu rendimiento de un vistazo"
        action={<Button onClick={() => openNewActivity('gpx')}><span aria-hidden className="text-base leading-none">+</span> Nueva salida</Button>} />

      {/* KPIs globales: todo el historial y el mes en curso */}
      <OverviewCards overview={overview} />

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
