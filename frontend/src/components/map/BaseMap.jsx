import { useEffect } from 'react'
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet'

// Mapa base oscuro. Por defecto Stadia "Alidade Smooth Dark" (sin clave en localhost;
// en producción requiere cuenta gratuita de Stadia). CARTO Dark Matter ahora exige API key:
// para usarlo, define VITE_MAP_TILE_URL y VITE_MAP_ATTRIBUTION en frontend/.env
const TILES = import.meta.env.VITE_MAP_TILE_URL
  || 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png'
const ATTRIBUTION = import.meta.env.VITE_MAP_ATTRIBUTION
  || '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

// Encaja el mapa a los límites [[lat, lon], [lat, lon]] cuando cambian
function FitBounds({ bounds, padding }) {
  const map = useMap()
  const key = bounds ? bounds.flat().join(',') : ''
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [padding, padding], maxZoom: 15 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, padding])
  return null
}

export function BaseMap({ bounds, padding = 32, className = '', children }) {
  return (
    <MapContainer center={[40.4168, -3.7038]} zoom={6} className={className} zoomControl={false}
      preferCanvas scrollWheelZoom attributionControl>
      {/* map-tiles: tinte azul marino de las teselas (index.css) para que el mapa sea parte de la interfaz */}
      <TileLayer url={TILES} attribution={ATTRIBUTION} maxZoom={20} className="map-tiles" />
      <ZoomControl position="bottomright" />
      <FitBounds bounds={bounds} padding={padding} />
      {children}
    </MapContainer>
  )
}
