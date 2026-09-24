const Activity = require('../models/activity.model');
const { HttpError } = require('../middlewares/errorHandler');

// Regla entre campos: la FC media no puede superar a la máxima
function assertHeartRateCoherent({ avgHr, maxHr }) {
  if (avgHr != null && maxHr != null && avgHr > maxHr) {
    throw new HttpError(400, 'La frecuencia cardíaca media no puede superar a la máxima');
  }
}

// Forma pública: la miniatura del track como routePreview (null si no hay track)
function toPublic({ track, ...activity }) {
  return { ...activity, routePreview: track ? JSON.parse(track.preview) : null };
}

// Devuelve la actividad solo si pertenece al usuario (404 en caso contrario,
// para no revelar si existe una actividad de otro usuario)
async function getOwnedOrFail(id, userId) {
  const activity = await Activity.findByIdForUser(id, userId);
  if (!activity) throw new HttpError(404, 'Actividad no encontrada');
  return activity;
}

async function list(userId, { from, to, limit, offset }) {
  const [data, total] = await Promise.all([
    Activity.findManyByUser({ userId, from, to, limit, offset }),
    Activity.countByUser({ userId, from, to }),
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

// Puntos completos del track para pintarlos en un mapa
async function getTrack(id, userId) {
  await getOwnedOrFail(id, userId);
  const track = await Activity.findTrack(id);
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

module.exports = { list, getById, create, createFromGpx, update, remove, getTrack };
