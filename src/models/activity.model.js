const prisma = require('./prisma');

// Las respuestas incluyen solo la miniatura del track, nunca todos los puntos
const withPreview = { track: { select: { preview: true } } };

const range = (min, max) => {
  if (min == null && max == null) return undefined;
  return { ...(min != null && { gte: min }), ...(max != null && { lte: max }) };
};

// Filtros del listado: fechas, texto en el título, distancia, desnivel y tipo
function buildWhere({ userId, from, to, q, minKm, maxKm, minElevation, maxElevation, sportType }) {
  const where = { userId };
  if (from || to) where.date = range(from, to);
  if (q) where.title = { contains: q };
  if (minKm != null || maxKm != null) where.distanceKm = range(minKm, maxKm);
  if (minElevation != null || maxElevation != null) where.elevationGain = range(minElevation, maxElevation);
  if (sportType) where.sportType = sportType;
  return where;
}

function findManyByUser({ limit, offset, ...filters }) {
  return prisma.activity.findMany({
    where: buildWhere(filters),
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: limit,
    skip: offset,
    include: withPreview,
  });
}

function countByUser(filters) {
  return prisma.activity.count({ where: buildWhere(filters) });
}

// Actividades con recorrido (polilínea o track) para pintarlas en el mapa
function findRoutes({ userId, from, to }) {
  return prisma.activity.findMany({
    where: { ...buildWhere({ userId, from, to }), OR: [{ summaryPolyline: { not: null } }, { track: { isNot: null } }] },
    orderBy: { date: 'desc' },
    select: {
      id: true, title: true, date: true, sportType: true, source: true, distanceKm: true,
      summaryPolyline: true, track: { select: { preview: true } },
    },
  });
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

// Ids de Strava ya importados de entre los indicados
async function findExistingStravaIds(stravaIds) {
  const rows = await prisma.activity.findMany({ where: { stravaId: { in: stravaIds } }, select: { stravaId: true } });
  return new Set(rows.map((r) => r.stravaId));
}

function createTrack(activityId, track) {
  return prisma.activityTrack.create({ data: { ...track, activityId } });
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
  findForStats, maxRecordedHr, findManyByUser, countByUser, findRoutes, findByIdForUser,
  create, createWithTrack, findTrack, createTrack, findExistingStravaIds, update, remove,
};
