const authService = require('../services/auth.service');
const profileService = require('../services/profile.service');
const { HttpError } = require('../errors');
const { parseProfile, PROFILE_FIELDS } = require('../utils/profileValidation');
const stravaService = require('../services/strava.service');
const googleService = require('../services/google.service');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt ignora lo que pase de 72 bytes

// Valida y normaliza { email, password } del body
function parseCredentials(body, { checkStrength }) {
  const { email, password } = body || {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new HttpError(400, 'Email y contraseña son obligatorios');
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail) || normalizedEmail.length > 254) {
    throw new HttpError(400, 'Email no válido');
  }

  if (checkStrength) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new HttpError(400, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
    }
    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
      throw new HttpError(400, `La contraseña no puede superar ${MAX_PASSWORD_LENGTH} bytes`);
    }
  } else if (password.length === 0) {
    throw new HttpError(400, 'Email y contraseña son obligatorios');
  }

  return { email: normalizedEmail, password };
}

// Registro: credenciales + datos de perfil opcionales (el alta por pasos los envía todos juntos)
async function register(req, res) {
  const { email, password } = parseCredentials(req.body, { checkStrength: true });
  const profile = parseProfile(req.body || {}, { ignore: ['email', 'password'] });
  const result = await authService.register(email, password, profile);
  res.status(201).json(result);
}

async function login(req, res) {
  const { email, password } = parseCredentials(req.body, { checkStrength: false });
  const result = await authService.login(email, password);
  res.json(result);
}

async function me(req, res) {
  res.json({ user: await profileService.getProfile(req.user.id) });
}

// Actualiza el perfil (nombre, datos físicos, FC); null borra un campo opcional
async function updateMe(req, res) {
  const changes = parseProfile(req.body || {}, { allowed: PROFILE_FIELDS });
  if (!Object.keys(changes).length) throw new HttpError(400, 'No hay campos para actualizar');
  res.json({ user: await profileService.updateProfile(req.user.id, changes) });
}

// "Continuar con Strava" (público): URL de autorización de Strava
async function stravaLoginUrl(req, res) {
  res.json({ url: stravaService.buildLoginUrl() });
}

// Canje del ticket que el callback de Strava o de Google deja en el frontend
async function exchange(req, res) {
  res.json(await authService.loginWithTicket(req.body?.ticket));
}

// --- Google ---

// "Continuar con Google" (público)
async function googleLoginUrl(req, res) {
  res.json({ url: googleService.buildLoginUrl() });
}

// Vincular Google a la cuenta con sesión iniciada
async function googleLinkUrl(req, res) {
  res.json({ url: googleService.buildLinkUrl(req.user.id) });
}

// Vuelta desde Google (navegador): siempre redirige al frontend con el resultado
async function googleCallback(req, res) {
  const { code, state, error } = req.query;
  res.redirect(await googleService.handleCallback({ code, state, error }));
}

async function googleStatus(req, res) {
  res.json(await googleService.status(req.user.id));
}

async function googleUnlink(req, res) {
  await googleService.unlink(req.user.id);
  res.status(204).end();
}

module.exports = {
  register, login, me, updateMe, stravaLoginUrl, exchange,
  googleLoginUrl, googleLinkUrl, googleCallback, googleStatus, googleUnlink,
};
