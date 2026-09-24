import { useMemo } from 'react'
import L from 'leaflet'
import { Marker, Tooltip } from 'react-leaflet'

// Iconos HTML (sin imágenes): inicio blanco, intermedios azules, final azul con borde
function icon(kind, label) {
  const styles = {
    start: 'bg-zinc-100 text-zinc-900',
    end: 'bg-series text-white ring-2 ring-zinc-100',
    via: 'bg-series text-white',
  }
  return L.divIcon({
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<div class="flex size-6 items-center justify-center rounded-full border-2 border-zinc-900 text-[10px] font-semibold shadow-lg shadow-black/50 cursor-grab ${styles[kind]}">${label}</div>`,
  })
}

export function WaypointMarkers({ waypoints, onMove, onRemove }) {
  const last = waypoints.length - 1
  const icons = useMemo(
    () => waypoints.map((_, i) => icon(i === 0 ? 'start' : i === last ? 'end' : 'via', i === 0 ? 'A' : i === last ? 'B' : i)),
    [waypoints, last],
  )
  return waypoints.map((w, i) => (
    <Marker key={w.id} position={[w.lat, w.lon]} icon={icons[i]} draggable autoPan
      eventHandlers={{
        dragend: (e) => {
          const { lat, lng } = e.target.getLatLng()
          onMove(w.id, lat, lng)
        },
        click: () => onRemove(w.id),
      }}>
      <Tooltip direction="top" offset={[0, -12]} className="route-tooltip">
        <span className="text-xs">Arrastra para mover · pulsa para quitar</span>
      </Tooltip>
    </Marker>
  ))
}
