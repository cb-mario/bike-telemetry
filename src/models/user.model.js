const prisma = require('./prisma');

// Campos públicos del usuario (nunca exponer passwordHash)
const publicFields = { id: true, email: true, createdAt: true };

function findByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

function findPublicById(id) {
  return prisma.user.findUnique({ where: { id }, select: publicFields });
}

function create({ email, passwordHash }) {
  return prisma.user.create({ data: { email, passwordHash }, select: publicFields });
}

module.exports = { findByEmail, findPublicById, create };
