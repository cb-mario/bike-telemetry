const { HttpError } = require('../middlewares/errorHandler');

// Enrutado ciclista con BRouter (https://brouter.de): sigue carreteras/caminos y devuelve altitud
const BROUTER_URL = () => (process.env.BROUTER_URL || 'https://brouter.de/brouter').replace(/\/$/, '');

// Perfil de la app → perfil de BRouter
const PROFILES = { road: 'fastbike', gravel: 'gravel', trekking: 'trekking' };
const TIMEOUT_MS = 20000;

// Ruta entre dos puntos [lat, lon]; devuelve { coords: [[lat, lon, ele|null]], distanceKm }
async function routeLeg(from, to, routing) {
  const profile = PROFILES[routing];
  if (!profile) throw new HttpError(400, `routing debe ser uno de: ${Object.keys(PROFILES).join(', ')}`);

  const lonlats = [from, to].map(([lat, lon]) => `${lon},${lat}`).join('|');
  const url = `${BROUTER_URL()}?lonlats=${lonlats}&profile=${profile}&alternativeidx=0&format=geojson`;

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new HttpError(502, 'El servicio de rutas no responde. Prueba de nuevo o usa el modo línea recta');
  }
  if (!res.ok) {
    // BRouter responde 4xx/5xx con texto cuando no hay camino (mar, zonas sin datos...)
    throw new HttpError(422, 'No se encontró un camino ciclable entre estos puntos');
  }

  const data = await res.json().catch(() => null);
  const feature = data?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) {
    throw new HttpError(502, 'Respuesta inesperada del servicio de rutas');
  }

  return {
    coords: coords.map(([lon, lat, ele]) => [lat, lon, Number.isFinite(ele) ? Math.round(ele * 10) / 10 : null]),
    distanceKm: Math.round(Number(feature.properties?.['track-length'] ?? 0) / 10) / 100,
  };
}

module.exports = { routeLeg, ROUTING_PROFILES: Object.keys(PROFILES) };
