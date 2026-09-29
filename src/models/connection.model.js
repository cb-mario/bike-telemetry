const prisma = require('./prisma');

// Conexión del usuario con un servicio externo ("strava", "igpsport"...). null si no está conectado
function find(userId, provider) {
  return prisma.connection.findUnique({ where: { userId_provider: { userId, provider } } });
}

// Usuario que tiene conectada esa cuenta del servicio (para no conectarla a dos usuarios)
function findByAccount(provider, account) {
  return prisma.connection.findUnique({ where: { provider_account: { provider, account } }, select: { userId: true } });
}

// Crea la conexión o la actualiza si ya existía (volver a conectar)
function save(userId, provider, data) {
  return prisma.connection.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, ...data },
    update: data,
  });
}

function update(userId, provider, data) {
  return prisma.connection.update({ where: { userId_provider: { userId, provider } }, data });
}

function remove(userId, provider) {
  return prisma.connection.deleteMany({ where: { userId, provider } });
}

module.exports = { find, findByAccount, save, update, remove };
