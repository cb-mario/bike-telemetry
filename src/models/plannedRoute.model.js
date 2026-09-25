const prisma = require('./prisma');

// El listado lleva la miniatura, nunca la geometría completa (puede tener miles de puntos)
const listFields = {
  id: true, name: true, routing: true, distanceKm: true, elevationGain: true,
  createdAt: true, updatedAt: true, preview: true,
};

function findManyByUser(userId, { limit } = {}) {
  return prisma.plannedRoute.findMany({
    where: { userId }, orderBy: { updatedAt: 'desc' }, select: listFields, take: limit,
  });
}

function findGeometries(ids) {
  return prisma.plannedRoute.findMany({ where: { id: { in: ids } }, select: { id: true, geometry: true } });
}

// SQL directo para no tocar updatedAt (ordena el listado): guardar la miniatura no es editar la ruta
function setPreview(id, preview) {
  return prisma.$executeRaw`UPDATE "PlannedRoute" SET "preview" = ${preview} WHERE "id" = ${id}`;
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

module.exports = { findManyByUser, findGeometries, setPreview, findByIdForUser, create, update, remove };
