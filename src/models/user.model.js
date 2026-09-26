const prisma = require('./prisma');

// Campos públicos del usuario. passwordHash se lee solo para saber si hay contraseña:
// toPublic lo cambia por hasPassword y el hash nunca sale del modelo
const publicFields = {
  id: true, email: true, name: true, birthDate: true, sex: true, heightCm: true, weightKg: true,
  restingHr: true, maxHr: true, createdAt: true, passwordHash: true, avatar: { select: { id: true } },
};

function toPublic(row) {
  if (!row) return row;
  const { passwordHash, avatar, ...user } = row;
  return { ...user, hasPassword: Boolean(passwordHash), avatarUrl: avatar ? `/api/avatars/${avatar.id}` : null };
}

function findByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

async function findPublicById(id) {
  return toPublic(await prisma.user.findUnique({ where: { id }, select: publicFields }));
}

async function create({ email, passwordHash, ...profile }) {
  return toPublic(await prisma.user.create({ data: { email, passwordHash, ...profile }, select: publicFields }));
}

// Para la recuperación de contraseña (necesita el hash actual para la huella del enlace)
function findCredentialsById(id) {
  return prisma.user.findUnique({ where: { id }, select: { id: true, email: true, passwordHash: true } });
}

async function updatePassword(id, passwordHash) {
  return toPublic(await prisma.user.update({ where: { id }, data: { passwordHash }, select: publicFields }));
}

async function updateProfile(id, data) {
  return toPublic(await prisma.user.update({ where: { id }, data, select: publicFields }));
}

// --- Foto de perfil ---

// Sustituye la foto (id nuevo, así la URL anterior deja de servir y la nueva no choca con la caché)
function replaceAvatar(userId, { data, contentType }) {
  return prisma.$transaction([
    prisma.userAvatar.deleteMany({ where: { userId } }),
    prisma.userAvatar.create({ data: { userId, data, contentType }, select: { id: true } }),
  ]);
}

function deleteAvatar(userId) {
  return prisma.userAvatar.deleteMany({ where: { userId } });
}

function findAvatar(id) {
  return prisma.userAvatar.findUnique({ where: { id }, select: { data: true, contentType: true } });
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

// --- iGPSPORT ---

const igpsportFields = {
  id: true, igpsportAccount: true, igpsportAccessToken: true, igpsportTokenExpiresAt: true, igpsportLastSyncAt: true,
};

function findIgpsportById(id) {
  return prisma.user.findUnique({ where: { id }, select: igpsportFields });
}

function updateIgpsport(id, data) {
  return prisma.user.update({ where: { id }, data, select: igpsportFields });
}

module.exports = {
  findIgpsportById, updateIgpsport,
  findByEmail, findPublicById, replaceAvatar, deleteAvatar, findAvatar, findCredentialsById, updatePassword, create, updateProfile, findStravaById, findByStravaAthleteId, updateStrava,
  findLoginMethods, canLoginWithoutStrava, createFromStrava, findByGoogleId, setGoogleId, createFromGoogle,
};
