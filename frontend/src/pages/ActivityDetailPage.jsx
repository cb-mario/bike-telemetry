import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CircleMarker, Polyline } from 'react-leaflet'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { estimateCalories } from '../lib/user'
import { api } from '../lib/api'
import { formatDate, formatDuration, formatNumber } from '../lib/format'
import { SOURCE_LABEL, sportLabel } from '../lib/sportTypes'
import { withDistance } from '../lib/track'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { FormError } from '../components/ui/Field'
import { Chip } from '../components/RideCard'
import { BaseMap } from '../components/map/BaseMap'
import { boundsOf } from '../lib/geo'
import { THEME } from '../lib/theme'
import { ElevationProfile } from '../components/ElevationProfile'
import { Icon } from '../components/ui/Icon'
import { InfoTip } from '../components/InfoTip'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// Una lectura del panel de métricas; la marca de color identifica el tipo de dato
function Metric({ label, value, unit, accent = 'bg-zinc-600', info }) {
  return (
    <div className="min-w-0 bg-zinc-900 p-4 sm:p-5">
      <p className="flex items-center gap-2 text-xs font-medium tracking-wider text-zinc-400 uppercase">
        <span aria-hidden className={`h-3 w-0.5 shrink-0 rounded-full ${accent}`} />
        <span className="truncate">{label}</span>
        {info && <InfoTip label={label}>{info}</InfoTip>}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-100 tabular-nums sm:text-3xl">
        {value}
        {unit && value !== '—' && <> <span className="ml-0.5 text-base font-normal tracking-normal text-zinc-400">{unit}</span></>}
      </p>
    </div>
  )
}

export function ActivityDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { refresh, toast } = useApp()
  const { user } = useAuth()
  const [activity, setActivity] = useState(null)
  const [track, setTrack] = useState(undefined) // undefined: cargando; null: sin track
  const [trackNote, setTrackNote] = useState('')
  const [error, setError] = useState('')
  const [hover, setHover] = useState({ index: null, point: null })
  const [deleting, setDeleting] = useState(false)
  const [repeating, setRepeating] = useState(false)

  // Convierte la salida en una ruta planificada para editarla o exportarla
  async function handleRepeat() {
    setRepeating(true)
    try {
      const route = await api(`/planned-routes/from-activity/${id}`, { method: 'POST' })
      toast(`Ruta "${route.name}" creada a partir de esta salida.`, 'success')
      navigate(`/rutas/${route.id}`)
    } catch (err) {
      toast(err.message, 'error')
      setRepeating(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    api(`/activities/${id}`)
      .then((a) => !cancelled && setActivity(a))
      .catch((err) => !cancelled && setError(err.message))
    api(`/activities/${id}/track`)
      .then((t) => !cancelled && setTrack(t))
      .catch((err) => {
        if (cancelled) return
        setTrack(null)
        // Strava desconectado o sin GPS: se usa la miniatura guardada si existe
        if (err.status !== 404) setTrackNote(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const points = useMemo(() => (track ? withDistance(track.segments) : []), [track])
  const segments = useMemo(() => {
    if (track) return track.segments.map((seg) => seg.map(([lat, lon]) => [lat, lon]))
    return activity?.routePreview ?? null
  }, [track, activity])
  const bounds = useMemo(() => (segments ? boundsOf(segments.flat()) : null), [segments])

  async function handleDelete() {
    setDeleting(true)
    try {
      await api(`/activities/${id}`, { method: 'DELETE' })
      refresh()
      toast('Salida borrada.', 'success')
      navigate('/salidas')
    } catch (err) {
      toast(err.message, 'error')
      setDeleting(false)
    }
  }

  if (error) {
    return (
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6">
        <FormError>{error}</FormError>
        <Link to="/salidas" className="inline-flex items-center gap-1.5 self-start text-sm text-zinc-400 transition-colors hover:text-zinc-100"><Icon name="arrowLeft" />Volver a Salidas</Link>
      </main>
    )
  }
  if (!activity) {
    return <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><Card as="div" className="h-96 animate-pulse" /></main>
  }

  const a = activity
  const avgSpeed = a.distanceKm / (a.durationMin / 60)
  const start = segments?.[0]?.[0]
  const end = segments?.at(-1)?.at(-1)

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <Link to="/salidas" className="inline-flex items-center gap-1.5 self-start text-sm text-zinc-400 transition-colors hover:text-zinc-100"><Icon name="arrowLeft" />Salidas</Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <Chip>{sportLabel(a.sportType)}</Chip>
            <Chip dot={a.source === 'strava' ? 'bg-strava' : undefined}>{SOURCE_LABEL[a.source] ?? 'Manual'}</Chip>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">{a.title}</h1>
          <p className="mt-1.5 text-sm text-zinc-400">{formatDate(a.date)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="ghost" />}>Borrar salida</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Borrar «{a.title}»?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminan la salida y su recorrido GPS. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete} loading={deleting}>Borrar salida</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {segments && (
            <Button variant="secondary" onClick={handleRepeat} loading={repeating}>
              Repetir esta ruta
            </Button>
          )}
        </div>
      </div>

      {segments ? (
        <Card className="overflow-hidden">
          <BaseMap bounds={bounds} padding={40} className="h-[22rem] sm:h-[28rem]">
            <Polyline positions={segments} pathOptions={{ color: THEME.casing, weight: 7, opacity: 0.6 }} interactive={false} />
            <Polyline positions={segments} pathOptions={{ color: THEME.route, weight: 3.5, opacity: 0.95 }} interactive={false} />
            {start && <CircleMarker center={start} radius={6} pathOptions={{ color: THEME.card, weight: 2, fillColor: THEME.ink, fillOpacity: 1 }} />}
            {end && <CircleMarker center={end} radius={6} pathOptions={{ color: THEME.card, weight: 2, fillColor: THEME.route, fillOpacity: 1 }} />}
            {hover.point && (
              <CircleMarker center={[hover.point.lat, hover.point.lon]} radius={7}
                pathOptions={{ color: THEME.card, weight: 2, fillColor: THEME.elev, fillOpacity: 1 }} />
            )}
          </BaseMap>
          {(trackNote || (!track && track !== undefined)) && (
            <p className="border-t border-zinc-800 px-5 py-3 text-xs text-zinc-500">
              {trackNote || 'Recorrido aproximado.'} Se muestra el trazado resumido.
            </p>
          )}
        </Card>
      ) : track !== undefined && (
        <Card className="px-5 py-10 text-center text-sm text-zinc-500">Esta salida no tiene recorrido GPS.</Card>
      )}

      {points.some((p) => p.ele != null) && (
        <Card>
          <CardHeader title="Perfil de altitud" description="Pasa el cursor para situar el punto en el mapa" />
          <div className="px-5 pt-4 pb-4">
            <ElevationProfile points={points} activeIndex={hover.index}
              onActiveChange={(index, point) => setHover({ index, point })} />
          </div>
        </Card>
      )}

      <Card as="div" className="overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-zinc-800 lg:grid-cols-4">
        <Metric label="Distancia" value={formatNumber(a.distanceKm, 1)} unit="km" accent="bg-dist" />
        <Metric label="Tiempo en movimiento" value={formatDuration(a.durationMin)} />
        <Metric label="Velocidad media" value={formatNumber(avgSpeed, 1)} unit="km/h" accent="bg-dist" />
        <Metric label="Velocidad máx." value={a.maxSpeedKmh != null ? formatNumber(a.maxSpeedKmh, 1) : '—'} unit="km/h" accent="bg-dist" />
        <Metric label="FC media" value={a.avgHr ?? '—'} unit="bpm" accent="bg-hr" />
        <Metric label="FC máx." value={a.maxHr ?? '—'} unit="bpm" accent="bg-hr" />
        <Metric label="Desnivel positivo" value={a.elevationGain != null ? formatNumber(a.elevationGain) : '—'} unit="m" accent="bg-elev" />
        <Metric label="Calorías (estim.)" unit="kcal" accent="bg-hr"
          info="Estimación de Keytel a partir de FC media, duración, peso, edad y sexo de tu perfil. Sin esos datos no se calcula."
          value={estimateCalories(a, user) != null ? formatNumber(estimateCalories(a, user)) : '—'} />
        </div>
      </Card>

      {a.notes && (
        <Card className="p-5">
          <p className="text-xs font-medium tracking-wider text-zinc-400 uppercase">Notas</p>
          <p className="mt-2 text-sm whitespace-pre-line text-zinc-200">{a.notes}</p>
        </Card>
      )}
    </main>
  )
}
