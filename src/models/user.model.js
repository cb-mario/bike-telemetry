const prisma = require('./prisma');

// Campos públicos del usuario (nunca exponer passwordHash)
const publicFields = {
  id: true, email: true, name: true, birthDate: true, sex: true, heightCm: true, weightKg: true,
  restingHr: true, maxHr: true, createdAt: true,
};

function findByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

function findPublicById(id) {
  return prisma.user.findUnique({ where: { id }, select: publicFields });
}

function create({ email, passwordHash, ...profile }) {
  return prisma.user.create({ data: { email, passwordHash, ...profile }, select: publicFields });
}

function updateProfile(id, data) {
  return prisma.user.update({ where: { id }, data, select: publicFields });
}

// --- Strava ---

const stravaFields = {
  id: true, stravaAthleteId: true, stravaAccessToken: true, stravaRefreshToken: true,
  stravaTokenExpiresAt: true, stravaLastSyncAt: true,
};

function findStravaById(id) {
  return prisma.user.findUnique({ where: { id }, select: stravaFields });
}

function findByStravaAthleteId(stravaAthleteId) {
  return prisma.user.findUnique({ where: { stravaAthleteId }, select: { id: true } });
}

function updateStrava(id, data) {
  return prisma.user.update({ where: { id }, data, select: stravaFields });
}

module.exports = {
  findByEmail, findPublicById, create, updateProfile, findStravaById, findByStravaAthleteId, updateStrava,
};
