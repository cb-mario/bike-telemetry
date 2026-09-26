const User = require('../models/user.model');
const { HttpError } = require('../errors');
const { ageOn } = require('../utils/profileValidation');

// Estimaciones a partir del perfil (null si faltan datos)
function estimatesFor(user, now = new Date()) {
  const age = user.birthDate ? ageOn(user.birthDate, now) : null;
  const bmi = user.heightCm && user.weightKg
    ? Math.round((user.weightKg / (user.heightCm / 100) ** 2) * 10) / 10
    : null;
  // Fórmula de Tanaka (2001): más precisa que 220 − edad en adultos
  const maxHr = age != null ? Math.round(208 - 0.7 * age) : null;
  const effectiveMaxHr = user.maxHr ?? maxHr;
  return {
    age,
    bmi,
    maxHr,
    // Reserva de FC (Karvonen): base para zonas por intensidad relativa
    hrReserve: effectiveMaxHr && user.restingHr ? effectiveMaxHr - user.restingHr : null,
  };
}

// Usuario público con sus estimaciones
function toPublicUser(user) {
  return user ? { ...user, estimates: estimatesFor(user) } : null;
}

// Regla entre campos: la FC en reposo tiene que ser menor que la máxima
function assertHrCoherent({ restingHr, maxHr }) {
  if (restingHr != null && maxHr != null && restingHr >= maxHr) {
    throw new HttpError(400, 'La FC en reposo debe ser menor que la máxima');
  }
}

async function getProfile(userId) {
  const user = await User.findPublicById(userId);
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  return toPublicUser(user);
}

// Aplica cambios ya validados (null borra un campo opcional)
async function updateProfile(userId, changes) {
  const current = await User.findPublicById(userId);
  if (!current) throw new HttpError(404, 'Usuario no encontrado');
  assertHrCoherent({ ...current, ...changes });

  try {
    return toPublicUser(await User.updateProfile(userId, changes));
  } catch (err) {
    // El usuario se ha borrado entre la lectura y la escritura
    if (err.code === 'P2025') throw new HttpError(404, 'Usuario no encontrado');
    throw err;
  }
}

// Tipo de imagen por sus primeros bytes (no por lo que diga el cliente); null si no es una admitida
function imageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

// Foto de perfil. El navegador ya la recorta y comprime; aquí solo se comprueba que sea una imagen
async function setAvatar(userId, buffer) {
  const contentType = imageType(buffer);
  if (!contentType) throw new HttpError(400, 'La foto tiene que ser JPG, PNG o WebP');
  await User.replaceAvatar(userId, { data: buffer, contentType });
  return getProfile(userId);
}

async function removeAvatar(userId) {
  await User.deleteAvatar(userId);
  return getProfile(userId);
}

module.exports = { estimatesFor, toPublicUser, assertHrCoherent, getProfile, updateProfile, imageType, setAvatar, removeAvatar };
