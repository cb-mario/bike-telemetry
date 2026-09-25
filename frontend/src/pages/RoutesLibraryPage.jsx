import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { useApiQuery } from '../lib/useApiQuery'
import { deletePlannedRoute, downloadGpx, importRouteGpx, listPlannedRoutes } from '../lib/planner'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/PageHeader'
import { RouteCard } from '../components/routes/RouteCard'

// Biblioteca de rutas planificadas: lo que quieres rodar
export function RoutesLibraryPage() {
  const { toast, refreshKey } = useApp()
  const navigate = useNavigate()
  const routesQuery = useApiQuery(listPlannedRoutes, [refreshKey])
  const routes = routesQuery.error ? [] : routesQuery.data ?? null
  const setRoutes = routesQuery.setData
  // Velocidad media histórica para estimar cuánto se tarda en cada ruta
  const avgSpeed = useApiQuery(() => api('/stats/summary'), [refreshKey]).data?.avgSpeedKmh ?? null
  const [downloadingId, setDownloadingId] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (routesQuery.error) toast(routesQuery.error, 'error')
  }, [routesQuery.error, toast])

  async function handleImport(file) {
    if (!file) return
    setImporting(true)
    try {
      const route = await importRouteGpx(file)
      toast(`Ruta "${route.name}" importada.`, 'success')
      navigate(`/rutas/${route.id}`)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDownload(id) {
    setDownloadingId(id)
    try {
      await downloadGpx(id)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleDelete(id) {
    try {
      await deletePlannedRoute(id)
      setRoutes((list) => list.filter((r) => r.id !== id))
      toast('Ruta borrada.', 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <PageHeader
        title="Rutas"
        description={routes ? `${routes.length} ${routes.length === 1 ? 'ruta planificada' : 'rutas planificadas'} para hacer` : 'Recorridos planificados para hacer'}
        action={
          <>
            <input ref={fileRef} type="file" accept=".gpx,application/gpx+xml" className="sr-only" tabIndex={-1}
              onChange={(e) => handleImport(e.target.files?.[0])} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={importing}>Importar GPX</Button>
            <Button onClick={() => navigate('/rutas/nueva')}>
              <span aria-hidden className="text-base leading-none">+</span> Nueva ruta
            </Button>
          </>
        }
      />

      {!routes ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Cargando rutas">
          {[0, 1, 2].map((i) => <Card as="li" key={i} className="h-80 animate-pulse" />)}
        </ul>
      ) : routes.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div>
            <p className="text-base font-medium text-zinc-100">Aún no tienes rutas planificadas</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-400">
              Dibuja una ruta en el mapa, impórtala desde Komoot o Wikiloc, o repite una de tus salidas.
              Después descárgala en GPX para tu ciclocomputador.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => navigate('/rutas/nueva')}>Crear una ruta</Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>Importar GPX</Button>
          </div>
        </Card>
      ) : (
        <ul className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {routes.map((r, i) => (
            <RouteCard key={r.id} route={r} index={i} avgSpeed={avgSpeed} downloading={downloadingId === r.id}
              onDownload={handleDownload} onDelete={handleDelete} />
          ))}
        </ul>
      )}
    </main>
  )
}
