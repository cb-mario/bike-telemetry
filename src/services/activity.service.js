const Activity = require('../models/activity.model');
const { HttpError } = require('../middlewares/errorHandler');

// Regla entre campos: la FC media no puede superar a la máxima
function assertHeartRateCoherent({ avgHr, maxHr }) {
  if (avgHr != null && maxHr != null && avgHr > maxHr) {
    throw new HttpError(400, 'La frecuencia cardíaca media no puede superar a la máxima');
  }
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
  return { data, total, limit, offset };
}

function getById(id, userId) {
  return getOwnedOrFail(id, userId);
}

function create(userId, data) {
  assertHeartRateCoherent(data);
  return Activity.create(userId, data);
}

async function update(id, userId, changes) {
  const current = await getOwnedOrFail(id, userId);
  assertHeartRateCoherent({ ...current, ...changes });
  return Activity.update(id, changes);
}

async function remove(id, userId) {
  await getOwnedOrFail(id, userId);
  await Activity.remove(id);
}

module.exports = { list, getById, create, update, remove };
