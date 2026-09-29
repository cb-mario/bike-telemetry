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
  if (q) where.title = { contains: q, mode: 'insensitive' }; // Postgres distingue mayúsculas por defecto
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
function findRoutes({ userId, from, to, limit }) {
  return prisma.activity.findMany({
    take: limit,
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

// Crea la actividad importada de un archivo y, si tiene GPS, su track en una sola operación
function createWithTrack(userId, data, track, source = 'gpx') {
  return prisma.activity.create({
    data: { ...data, userId, source, ...(track && { track: { create: track } }) },
    include: withPreview,
  });
}

// --- Salidas de servicios externos (ActivityImport) ---

// Crea la actividad (con su track, si lo hay) y la anota como importada de ese servicio,
// en una sola operación
function createImported(userId, data, { provider, externalId }, track = null) {
  return prisma.activity.create({
    data: { ...data, userId, imports: { create: { provider, externalId } }, ...(track && { track: { create: track } }) },
    include: withPreview,
  });
}

// Anota una actividad que ya existía como la misma salida de ese servicio
function addImport(activityId, { provider, externalId }) {
  return prisma.activityImport.create({ data: { activityId, provider, externalId } });
}

// Ids del servicio ya importados de entre los indicados
async function findImportedIds(provider, externalIds) {
  const rows = await prisma.activityImport.findMany({
    where: { provider, externalId: { in: externalIds } },
    select: { externalId: true },
  });
  return new Set(rows.map((r) => r.externalId));
}

// Id de la actividad en ese servicio (null si no llegó de él)
async function findExternalId(activityId, provider) {
  const row = await prisma.activityImport.findFirst({ where: { activityId, provider }, select: { externalId: true } });
  return row?.externalId ?? null;
}

// Fecha de la salida más antigua importada de ese servicio (null si no hay)
async function oldestImportDate(userId, provider) {
  const result = await prisma.activity.aggregate({
    where: { userId, imports: { some: { provider } } },
    _min: { date: true },
  });
  return result._min.date;
}

// Actividad del usuario que empieza entre `from` y `to` (la más cercana a `date`)
async function findStartingBetween(userId, date, { from, to }) {
  const rows = await prisma.activity.findMany({
    where: { userId, date: { gte: from, lte: to } },
    select: { id: true, title: true, date: true },
  });
  const distance = (a) => Math.abs(a.date.getTime() - date.getTime());
  return rows.sort((a, b) => distance(a) - distance(b))[0] ?? null;
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
  create, createWithTrack, findTrack, createTrack, update, remove,
  createImported, addImport, findImportedIds, findExternalId, oldestImportDate, findStartingBetween,
};
