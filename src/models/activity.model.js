const prisma = require('./prisma');

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
  });
}

function countByUser({ userId, from, to }) {
  return prisma.activity.count({ where: buildWhere({ userId, from, to }) });
}

function findByIdForUser(id, userId) {
  return prisma.activity.findFirst({ where: { id, userId } });
}

function create(userId, data) {
  return prisma.activity.create({ data: { ...data, userId } });
}

function update(id, data) {
  return prisma.activity.update({ where: { id }, data });
}

function remove(id) {
  return prisma.activity.delete({ where: { id } });
}

module.exports = { findManyByUser, countByUser, findByIdForUser, create, update, remove };
