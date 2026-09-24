const prisma = require('./prisma');

// Las respuestas incluyen solo la miniatura del track, nunca todos los puntos
const withPreview = { track: { select: { preview: true } } };

// Filtro por usuario y rango de fechas opcional
function buildWhere({ userId, from, to }) {
  const where = { userId };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }
  return where;
}

function findManyByUser({ userId, from, to, limit, offset }) {
  return prisma.activity.findMany({
    where: buildWhere({ userId, from, to }),
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: limit,
    skip: offset,
    include: withPreview,
  });
}

function countByUser({ userId, from, to }) {
  return prisma.activity.count({ where: buildWhere({ userId, from, to }) });
}

function findByIdForUser(id, userId) {
  return prisma.activity.findFirst({ where: { id, userId }, include: withPreview });
}

function create(userId, data) {
  return prisma.activity.create({ data: { ...data, userId }, include: withPreview });
}

// Crea la actividad y su track en una sola operación
function createWithTrack(userId, data, track) {
  return prisma.activity.create({
    data: { ...data, userId, source: 'gpx', track: { create: track } },
    include: withPreview,
  });
}

function findTrack(activityId) {
  return prisma.activityTrack.findUnique({ where: { activityId } });
}

function update(id, data) {
  return prisma.activity.update({ where: { id }, data, include: withPreview });
}

function remove(id) {
  return prisma.activity.delete({ where: { id } });
}

// Campos necesarios para calcular estadísticas, en orden cronológico
function findForStats({ userId, from, to }) {
  return prisma.activity.findMany({
    where: buildWhere({ userId, from, to }),
    orderBy: { date: 'asc' },
    select: {
      id: true, title: true, date: true, distanceKm: true, durationMin: true,
      elevationGain: true, avgHr: true, maxHr: true,
    },
  });
}

// FC máxima registrada en cualquier actividad del usuario
async function maxRecordedHr(userId) {
  const result = await prisma.activity.aggregate({ where: { userId }, _max: { maxHr: true } });
  return result._max.maxHr;
}

module.exports = {
  findForStats, maxRecordedHr, findManyByUser, countByUser, findByIdForUser,
  create, createWithTrack, findTrack, update, remove,
};
