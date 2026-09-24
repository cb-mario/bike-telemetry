import { useEffect, useRef, useState } from 'react'
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
import { NewActivity } from '../components/NewActivity'

export function DashboardPage() {
  const { user, logout } = useAuth()
  const [range, setRange] = useState('12w')
  const [refreshKey, setRefreshKey] = useState(0)
  const [creating, setCreating] = useState(false)
  const [droppedFile, setDroppedFile] = useState(null)
  const fileDragging = useWindowFileDrag(!creating, (file) => {
    setDroppedFile(file)
    setCreating(true)
  })
  const overview = useOverview(refreshKey)
  const { data, loading, error, loadMoreActivities } = useDashboardData(range, refreshKey)

  const refresh = () => setRefreshKey((k) => k + 1)
  const closeDialog = () => {
    setCreating(false)
    setDroppedFile(null)
  }

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

      <Dialog open={creating} onClose={closeDialog} title="Nueva salida"
        description="Importa un archivo GPX o introduce los datos a mano.">
        <NewActivity initialFile={droppedFile} onCreated={refresh} onClose={closeDialog} />
      </Dialog>

      {fileDragging && <DropOverlay />}
    </div>
  )
}

// Detecta archivos arrastrados sobre la ventana y entrega el que se suelte
function useWindowFileDrag(enabled, onDropFile) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const onDropRef = useRef(onDropFile)
  useEffect(() => {
    onDropRef.current = onDropFile
  })

  useEffect(() => {
    const hasFiles = (e) => e.dataTransfer?.types?.includes('Files')
    const reset = () => {
      depth.current = 0
      setDragging(false)
    }
    const onEnter = (e) => {
      if (!enabled || !hasFiles(e)) return
      depth.current += 1
      setDragging(true)
    }
    const onLeave = (e) => {
      if (!enabled || !hasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    // Siempre se evita que el navegador abra el archivo si se suelta fuera de una zona válida
    const onOver = (e) => hasFiles(e) && e.preventDefault()
    const onDrop = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      const file = e.dataTransfer.files?.[0]
      const wasDragging = depth.current > 0
      reset()
      if (enabled && wasDragging && file) onDropRef.current(file)
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [enabled])

  return enabled && dragging
}

function DropOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-dashed border-series bg-zinc-900/80 px-8 py-14 text-center shadow-2xl">
        <div className="flex size-14 items-center justify-center rounded-full bg-series text-white">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.75"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight text-zinc-100">Suelta tu archivo GPX</p>
          <p className="mt-1 text-sm text-zinc-400">Se importará como una nueva salida</p>
        </div>
      </div>
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
