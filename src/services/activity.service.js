const Activity = require('../models/activity.model');
const { HttpError } = require('../middlewares/errorHandler');
const polyline = require('../utils/polyline');
const { simplifyCoords, MAX_PREVIEW_POINTS } = require('./track.service');

const MAX_MAP_POINTS = 200;

// Coordenadas del recorrido por segmentos: track guardado o, si no, la polilínea de Strava
function routeSegments({ track, summaryPolyline }, maxPoints) {
  if (track?.preview && maxPoints <= MAX_PREVIEW_POINTS) return JSON.parse(track.preview);
  if (summaryPolyline) {
    try {
      const coords = polyline.decode(summaryPolyline);
      return coords.length > 1 ? [simplifyCoords(coords, maxPoints)] : null;
    } catch {
      return null;
    }
  }
  return track?.preview ? JSON.parse(track.preview) : null;
}

// Regla entre campos: la FC media no puede superar a la máxima
function assertHeartRateCoherent({ avgHr, maxHr }) {
  if (avgHr != null && maxHr != null && avgHr > maxHr) {
    throw new HttpError(400, 'La frecuencia cardíaca media no puede superar a la máxima');
  }
}

// Forma pública: sin datos internos del recorrido, con la miniatura como routePreview
function toPublic({ track, summaryPolyline, ...activity }) {
  return { ...activity, routePreview: routeSegments({ track, summaryPolyline }, MAX_PREVIEW_POINTS) };
}

// Devuelve la actividad solo si pertenece al usuario (404 en caso contrario,
// para no revelar si existe una actividad de otro usuario)
async function getOwnedOrFail(id, userId) {
  const activity = await Activity.findByIdForUser(id, userId);
  if (!activity) throw new HttpError(404, 'Actividad no encontrada');
  return activity;
}

async function list(userId, { limit, offset, ...filters }) {
  const [data, total] = await Promise.all([
    Activity.findManyByUser({ userId, limit, offset, ...filters }),
    Activity.countByUser({ userId, ...filters }),
  ]);
  return { data: data.map(toPublic), total, limit, offset };
}

async function getById(id, userId) {
  return toPublic(await getOwnedOrFail(id, userId));
}

async function create(userId, data) {
  assertHeartRateCoherent(data);
  return toPublic(await Activity.create(userId, data));
}

async function createFromGpx(userId, data, track) {
  assertHeartRateCoherent(data);
  return toPublic(await Activity.createWithTrack(userId, data, track));
}

async function update(id, userId, changes) {
  const current = await getOwnedOrFail(id, userId);
  assertHeartRateCoherent({ ...current, ...changes });
  return toPublic(await Activity.update(id, changes));
}

// Todas las rutas del usuario para el mapa del explorador
async function routes(userId, { from, to }) {
  const rows = await Activity.findRoutes({ userId, from, to });
  return rows
    .map(({ track, summaryPolyline, ...a }) => ({ ...a, segments: routeSegments({ track, summaryPolyline }, MAX_MAP_POINTS) }))
    .filter((r) => r.segments);
}

// Puntos completos del track para pintarlos en un mapa
async function getTrack(id, userId) {
  const activity = await getOwnedOrFail(id, userId);
  let track = await Activity.findTrack(id);
  // Actividades de Strava: el track completo se descarga la primera vez que se pide
  if (!track && activity.source === 'strava' && activity.stravaId) {
    // Carga diferida para evitar una dependencia circular entre servicios
    track = await require('./strava.service').importStreams(userId, activity);
  }
  if (!track) throw new HttpError(404, 'Esta actividad no tiene track GPS');

  const { minLat, maxLat, minLon, maxLon } = track;
  return {
    activityId: id,
    pointCount: track.pointCount,
    bounds: { minLat, maxLat, minLon, maxLon },
    pointFormat: ['lat', 'lon', 'ele', 'secondsFromStart', 'hr'],
    segments: JSON.parse(track.points),
  };
}

async function remove(id, userId) {
  await getOwnedOrFail(id, userId);
  await Activity.remove(id);
}

module.exports = { list, routes, getById, create, createFromGpx, update, remove, getTrack };
