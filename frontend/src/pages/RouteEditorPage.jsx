import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CircleMarker, Polyline, useMapEvents } from 'react-leaflet'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { formatDuration, formatNumber } from '../lib/format'
import { boundsOf } from '../lib/geo'
import { ROUTING_OPTIONS, downloadGpx, getPlannedRoute, savePlannedRoute } from '../lib/planner'
import { elevationGain, lengthKm, withDistance } from '../lib/track'
import { useRouteLegs } from '../lib/useRouteLegs'
import { BaseMap } from '../components/map/BaseMap'
import { WaypointMarkers } from '../components/planner/WaypointMarkers'
import { PanelSection } from '../components/planner/PanelSection'
import { ElevationProfile } from '../components/ElevationProfile'
import { Button } from '../components/ui/Button'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Label } from '../components/ui/Text'
import { Spinner } from '../components/ui/Spinner'

let nextId = 1
const waypoint = (lat, lon) => ({ id: nextId++, lat, lon })

// Añade un punto al pulsar en el mapa
function ClickToAdd({ onAdd }) {
  useMapEvents({ click: (e) => onAdd(e.latlng.lat, e.latlng.lng) })
  return null
}

function Stat({ label, value, unit, accent }) {
  return (
    <div className="min-w-0">
      <Label as="dt" className="flex items-center gap-1.5">
        {accent && <span aria-hidden className={`size-1.5 rounded-full ${accent}`} />}
        {label}
      </Label>
      <dd className="mt-1 text-xl font-semibold tracking-tight whitespace-nowrap text-zinc-100">
        {value}{unit && <span className="ml-1 text-sm font-normal text-zinc-400">{unit}</span>}
      </dd>
    </div>
  )
}

// Editor de una ruta planificada: /rutas/nueva o /rutas/:id
export function RouteEditorPage() {
  const { toast } = useApp()
  const navigate = useNavigate()
  const { id: routeParam } = useParams()
  const routeId = routeParam ? Number(routeParam) : null
  const [waypoints, setWaypoints] = useState([])
  const [routing, setRouting] = useState('road')
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [showRides, setShowRides] = useState(false)
  const [rides, setRides] = useState(null)
  const [avgSpeed, setAvgSpeed] = useState(null)
  const [hover, setHover] = useState({ index: null, point: null })
  const [fitTo, setFitTo] = useState(null)
  // Trazado de la ruta guardada abierta: se muestra tal cual hasta que se modifique
  const [openedGeometry, setOpenedGeometry] = useState(null)
  const [loadingRoute, setLoadingRoute] = useState(Boolean(routeId))

  const legs = useRouteLegs(waypoints, openedGeometry ? 'straight' : routing)
  const geometry = openedGeometry ?? legs.geometry
  const loading = !openedGeometry && legs.loading
  const error = openedGeometry ? null : legs.error
  const distance = geometry.length > 1 ? lengthKm(geometry) : 0
  const gain = useMemo(() => elevationGain(geometry), [geometry])
  const profilePoints = useMemo(() => withDistance([geometry]), [geometry])
  const hasElevation = geometry.filter((c) => c[2] != null).length > 1

  useEffect(() => {
    // Velocidad media histórica para estimar el tiempo de la ruta
    api('/stats/summary').then((s) => setAvgSpeed(s.avgSpeedKmh)).catch(() => {})
    // Encuadre inicial: la zona donde sueles rodar (sin salidas virtuales), para marcar puntos con buen zoom
    api('/activities/routes')
      .then((list) => {
        setRides(list)
        const real = list.filter((r) => r.sportType !== 'VirtualRide')
        if (real.length) setFitTo((current) => current ?? boundsOf(real.flatMap((r) => r.segments.flat())))
      })
      .catch(() => setRides([]))
  }, [])

  const change = (fn) => {
    setWaypoints(fn)
    setOpenedGeometry(null)
    setDirty(true)
  }
  const add = (lat, lon) => change((w) => [...w, waypoint(lat, lon)])
  const move = (id, lat, lon) => change((w) => w.map((p) => (p.id === id ? { ...p, lat, lon } : p)))
  const remove = (id) => change((w) => w.filter((p) => p.id !== id))
  const undo = () => change((w) => w.slice(0, -1))
  const reverse = () => change((w) => [...w].reverse())
  const closeLoop = () => change((w) => [...w, waypoint(w[0].lat, w[0].lon)])

  function reset() {
    setOpenedGeometry(null)
    setWaypoints([])
    setName('')
    setEditingId(null)
    setDirty(false)
  }

  // Al pasar de una ruta a /rutas/nueva, el editor se vacía (ajuste durante el render)
  const [prevRouteId, setPrevRouteId] = useState(routeId)
  if (routeId !== prevRouteId) {
    setPrevRouteId(routeId)
    if (!routeId) reset()
    else if (routeId !== editingId) setLoadingRoute(true)
  }

  // Carga la ruta de la URL (salvo si es la que se acaba de guardar desde este editor)
  useEffect(() => {
    if (!routeId || routeId === editingId) return
    let cancelled = false
    getPlannedRoute(routeId)
      .then((route) => {
        if (cancelled) return
        setWaypoints(route.waypoints.map(([lat, lon]) => waypoint(lat, lon)))
        setRouting(route.routing)
        setOpenedGeometry(route.geometry)
        setName(route.name)
        setEditingId(route.id)
        setDirty(false)
        setFitTo(boundsOf(route.geometry))
      })
      .catch((err) => {
        if (cancelled) return
        toast(err.message, 'error')
        navigate('/rutas', { replace: true })
      })
      .finally(() => !cancelled && setLoadingRoute(false))
    return () => {
      cancelled = true
    }
  }, [routeId, editingId, navigate, toast])

  async function save() {
    const routeName = name.trim() || `Ruta de ${formatNumber(distance, 0)} km`
    setSaving(true)
    try {
      const route = await savePlannedRoute(editingId, {
        name: routeName,
        routing,
        waypoints: waypoints.map((w) => [w.lat, w.lon]),
        geometry,
      })
      setEditingId(route.id)
      setName(route.name)
      setDirty(false)
      if (route.id !== routeId) navigate(`/rutas/${route.id}`, { replace: true })
      toast(`Ruta "${route.name}" guardada.`, 'success')
      return route
    } catch (err) {
      toast(err.message, 'error')
      return null
    } finally {
      setSaving(false)
    }
  }

  async function download(id) {
    setBusyId(id)
    try {
      await downloadGpx(id)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  // Descargar la ruta en edición: se guarda antes si hay cambios
  async function downloadCurrent() {
    const id = dirty || !editingId ? (await save())?.id : editingId
    if (id) await download(id)
  }

  const eta = avgSpeed && distance ? Math.round((distance / avgSpeed) * 60) : null
  const canSave = waypoints.length >= 2 && !loading

  return (
    <main className="relative flex flex-col lg:block lg:h-[calc(100svh-3.5rem)]">
      <BaseMap bounds={fitTo} padding={60} className="h-[55svh] lg:h-full">
        <ClickToAdd onAdd={add} />
        {showRides && rides?.map((r) => (
          <Polyline key={r.id} positions={r.segments} interactive={false}
            pathOptions={{ color: '#a1a1aa', weight: 2, opacity: 0.35 }} />
        ))}
        {geometry.length > 1 && (
          <>
            <Polyline positions={geometry.map(([lat, lon]) => [lat, lon])} interactive={false}
              pathOptions={{ color: '#3987e5', weight: 10, opacity: 0.18 }} />
            <Polyline positions={geometry.map(([lat, lon]) => [lat, lon])} interactive={false}
              pathOptions={{ color: '#3987e5', weight: 4, opacity: 0.95, dashArray: loading ? '6 8' : null }} />
          </>
        )}
        {hover.point && (
          <CircleMarker center={[hover.point.lat, hover.point.lon]} radius={7}
            pathOptions={{ color: '#18181b', weight: 2, fillColor: '#c98500', fillOpacity: 1 }} />
        )}
        <WaypointMarkers waypoints={waypoints} onMove={move} onRemove={remove} />
      </BaseMap>

      {/* Panel: flotante en escritorio, debajo del mapa en móvil */}
      <aside className="z-[500] flex flex-col gap-4 border-t border-zinc-800 bg-zinc-900/80 p-4 backdrop-blur-md
        lg:absolute lg:top-4 lg:left-4 lg:max-h-[calc(100%-2rem)] lg:w-[23rem] lg:overflow-y-auto lg:rounded-2xl lg:border lg:shadow-2xl lg:shadow-black/40">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Link to="/rutas" className="text-xs text-zinc-400 transition-colors hover:text-zinc-100">← Rutas</Link>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-zinc-100">
              {editingId ? 'Editar ruta' : 'Nueva ruta'}
            </h1>
          </div>
          {(waypoints.length > 0 || editingId) && (
            <Button variant="ghost" size="sm" onClick={() => { reset(); navigate('/rutas/nueva') }}>Empezar otra</Button>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <Label as="span">Nombre</Label>
          <input value={name} onChange={(e) => { setName(e.target.value); setDirty(true) }} maxLength={100}
            placeholder="Ej. Vuelta por la sierra"
            className="h-9 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all duration-200 hover:border-zinc-700 focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-series/40" />
        </label>

        <div className="flex flex-col gap-1.5">
          <Label as="span">Tipo de vía</Label>
          <SegmentedControl label="Tipo de vía" options={ROUTING_OPTIONS} value={routing}
            onChange={(v) => { setRouting(v); setOpenedGeometry(null); setDirty(true) }} />
        </div>

        {loadingRoute ? (
          <div className="h-40 animate-pulse rounded-xl bg-zinc-800/40" aria-busy="true" aria-label="Cargando ruta" />
        ) : waypoints.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-700 px-4 py-5 text-center text-sm text-zinc-400">
            Toca el mapa para marcar el inicio y sigue añadiendo puntos. La ruta se ajusta a las vías automáticamente.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-3">
              <Stat label="Distancia" value={formatNumber(distance, 1)} unit="km" accent="bg-dist" />
              <Stat label="Desnivel" value={gain != null ? formatNumber(gain) : '—'} unit={gain != null ? 'm' : undefined} accent="bg-elev" />
              <Stat label="Tiempo" value={eta ? formatDuration(eta) : '—'} />
            </dl>
            {eta && <p className="-mt-2 text-[11px] text-zinc-500">Estimado a tu velocidad media ({formatNumber(avgSpeed, 1)} km/h)</p>}
            {loading && <p className="flex items-center gap-2 text-xs text-zinc-400"><Spinner className="size-3" /> Calculando ruta…</p>}
            {error && (
              <p role="alert" className="text-xs text-zinc-300">
                <span aria-hidden className="text-critical">● </span>{error}. Ese tramo se muestra en línea recta.
              </p>
            )}

            {hasElevation && (
              <ElevationProfile points={profilePoints} height={130} activeIndex={hover.index}
                onActiveChange={(index, point) => setHover({ index, point })} />
            )}

            <div className="flex flex-wrap gap-1.5">
              <Button variant="secondary" size="sm" onClick={undo}>Deshacer</Button>
              <Button variant="secondary" size="sm" onClick={closeLoop} disabled={waypoints.length < 2}>Volver al inicio</Button>
              <Button variant="secondary" size="sm" onClick={reverse} disabled={waypoints.length < 2}>Invertir</Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={save} loading={saving} disabled={!canSave || (!dirty && editingId)}>
                {editingId ? (dirty ? 'Guardar cambios' : 'Guardada') : 'Guardar ruta'}
              </Button>
              <Button variant="secondary" onClick={downloadCurrent} disabled={!canSave} loading={busyId === editingId && busyId != null}>
                Descargar GPX
              </Button>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Importa el GPX como recorrido en Garmin Connect, Wahoo, Hammerhead o Bryton, o cópialo por USB a tu ciclocomputador.
            </p>
          </>
        )}

        <PanelSection title="Capas">
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-zinc-300">
            Mostrar mis salidas en el mapa
            <input type="checkbox" checked={showRides} onChange={(e) => setShowRides(e.target.checked)}
              className="size-4 accent-[#3987e5]" />
          </label>
        </PanelSection>
      </aside>
    </main>
  )
}
