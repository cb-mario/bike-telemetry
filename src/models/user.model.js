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

// Formas de entrar de la cuenta (solo para decidir si se puede quitar una; nunca se expone)
function findLoginMethods(id) {
  return prisma.user.findUnique({ where: { id }, select: { passwordHash: true, googleId: true, stravaAthleteId: true } });
}

// ¿Puede entrar sin Strava (con contraseña o con Google)?
async function canLoginWithoutStrava(id) {
  const user = await findLoginMethods(id);
  return Boolean(user?.passwordHash || user?.googleId);
}

// Cuenta nueva desde "Continuar con Strava" (sin email ni contraseña)
function createFromStrava(data) {
  return prisma.user.create({ data, select: { id: true } });
}

function updateStrava(id, data) {
  return prisma.user.update({ where: { id }, data, select: stravaFields });
}

// --- Google ---

function findByGoogleId(googleId) {
  return prisma.user.findUnique({ where: { googleId }, select: { id: true } });
}

function setGoogleId(id, googleId) {
  return prisma.user.update({ where: { id }, data: { googleId }, select: { id: true } });
}

// Cuenta nueva desde "Continuar con Google" (email verificado por Google, sin contraseña)
function createFromGoogle(data) {
  return prisma.user.create({ data, select: { id: true } });
}

module.exports = {
  findByEmail, findPublicById, create, updateProfile, findStravaById, findByStravaAthleteId, updateStrava,
  findLoginMethods, canLoginWithoutStrava, createFromStrava, findByGoogleId, setGoogleId, createFromGoogle,
};
