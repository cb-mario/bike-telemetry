const Activity = require('../models/activity.model');
const { HttpError } = require('../errors');
const polyline = require('../utils/polyline');
const { parseActivity } = require('../utils/activityValidation');
const { simplifyCoords, MAX_PREVIEW_POINTS } = require('./track.service');
const { analyzeGpx } = require('./gpx.service');
const { analyzeFit } = require('./fit.service');
const stravaService = require('./strava.service');

const MAX_MAP_POINTS = 200;
// Dos salidas que empiezan con menos de un minuto de diferencia se consideran la misma
const DUPLICATE_MARGIN_MS = 60 * 1000;

const FORMAT_LABEL = { gpx: 'GPX', fit: 'FIT' };

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

// Analiza un .gpx o un .fit y devuelve los datos validados de la actividad, su track y su polilínea.
// `title` opcional: si no, el del archivo o la fecha
async function analyzeFile(buffer, { format, title }) {
  const analysis = format === 'fit' ? await analyzeFit(buffer) : analyzeGpx(buffer);
  const { name, stats, track, summaryPolyline, sportType } = analysis;
  const finalTitle = title?.trim() || name?.trim() || `Salida del ${stats.startTime.toISOString().slice(0, 10)}`;

  // Los datos calculados pasan por la misma validación que una actividad manual
  let data;
  try {
    data = parseActivity({
      title: finalTitle.slice(0, 100),
      date: stats.startTime.toISOString(),
      distanceKm: stats.distanceKm,
      durationMin: stats.durationMin,
      elevationGain: stats.elevationGain,
      avgHr: stats.avgHr,
      maxHr: stats.maxHr,
      maxSpeedKmh: stats.maxSpeedKmh,
      ...(sportType && { sportType }),
    }, { partial: false });
  } catch (err) {
    if (err instanceof HttpError) throw new HttpError(400, `El ${FORMAT_LABEL[format]} genera datos no válidos: ${err.message}`);
    throw err;
  }

  assertHeartRateCoherent(data);
  return { data: { ...data, summaryPolyline }, track };
}

// Crea la actividad (y su track, si hay GPS) a partir de un .gpx o un .fit. Con `skipDuplicates`,
// 409 si ya existe una salida que empezó a la misma hora (para poder cargar varias veces la misma carpeta)
async function importFile(userId, buffer, { format = 'gpx', title, skipDuplicates = false } = {}) {
  const { data, track } = await analyzeFile(buffer, { format, title });
  const existing = skipDuplicates && await Activity.findStartingNear(userId, data.date, DUPLICATE_MARGIN_MS);
  if (existing) throw new HttpError(409, `Esta salida ya está guardada («${existing.title}»)`);

  return toPublic(await Activity.createWithTrack(userId, data, track, format));
}

// Salida descargada de iGPSPORT: se crea o, si ya estaba (llegó por Strava, por un FIT...),
// se vincula a su rideId para no volver a descargarla. Devuelve 'imported' o 'linked'
async function importIgpsportRide(userId, buffer, { igpsportId, title }) {
  const { data, track } = await analyzeFile(buffer, { format: 'fit', title });
  const existing = await Activity.findStartingNear(userId, data.date, DUPLICATE_MARGIN_MS);
  if (existing) {
    await Activity.linkIgpsport(existing.id, igpsportId);
    return 'linked';
  }
  try {
    await Activity.createWithTrack(userId, { ...data, igpsportId }, track, 'igpsport');
  } catch (err) {
    if (err.code === 'P2002') return 'linked'; // ya importada por una sincronización simultánea
    throw err;
  }
  return 'imported';
}

async function update(id, userId, changes) {
  const current = await getOwnedOrFail(id, userId);
  assertHeartRateCoherent({ ...current, ...changes });
  return toPublic(await Activity.update(id, changes));
}

// Todas las rutas del usuario para el mapa del explorador
async function routes(userId, { from, to, limit }) {
  const rows = await Activity.findRoutes({ userId, from, to, limit });
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
    track = await stravaService.importStreams(userId, activity);
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

module.exports = { list, routes, getById, create, importFile, importIgpsportRide, update, remove, getTrack };
