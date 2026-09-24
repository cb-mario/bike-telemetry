const prisma = require('./prisma');

const listFields = {
  id: true, name: true, routing: true, distanceKm: true, elevationGain: true,
  createdAt: true, updatedAt: true, geometry: true,
};

function findManyByUser(userId) {
  return prisma.plannedRoute.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, select: listFields });
}

function findByIdForUser(id, userId) {
  return prisma.plannedRoute.findFirst({ where: { id, userId } });
}

function create(userId, data) {
  return prisma.plannedRoute.create({ data: { ...data, userId } });
}

function update(id, data) {
  return prisma.plannedRoute.update({ where: { id }, data });
}

function remove(id) {
  return prisma.plannedRoute.delete({ where: { id } });
}

module.exports = { findManyByUser, findByIdForUser, create, update, remove };
