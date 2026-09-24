const authService = require('../services/auth.service');
const User = require('../models/user.model');
const { HttpError } = require('../middlewares/errorHandler');
const { parseNumber } = require('../utils/validation');

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

async function register(req, res) {
  const { email, password } = parseCredentials(req.body, { checkStrength: true });
  const result = await authService.register(email, password);
  res.status(201).json(result);
}

async function login(req, res) {
  const { email, password } = parseCredentials(req.body, { checkStrength: false });
  const result = await authService.login(email, password);
  res.json(result);
}

async function me(req, res) {
  const user = await User.findPublicById(req.user.id);
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  res.json({ user });
}

// Actualiza el perfil: por ahora solo maxHr (null para borrarlo)
async function updateMe(req, res) {
  const body = req.body || {};
  const unknown = Object.keys(body).filter((key) => key !== 'maxHr');
  if (unknown.length) throw new HttpError(400, `Campos no permitidos: ${unknown.join(', ')}`);
  if (body.maxHr === undefined) throw new HttpError(400, 'No hay campos para actualizar');

  const maxHr = body.maxHr === null
    ? null
    : parseNumber(body.maxHr, 'maxHr', { min: 100, max: 220, integer: true });

  try {
    const user = await User.updateProfile(req.user.id, { maxHr });
    res.json({ user });
  } catch (err) {
    // Token válido de un usuario que ya no existe
    if (err.code === 'P2025') throw new HttpError(404, 'Usuario no encontrado');
    throw err;
  }
}

module.exports = { register, login, me, updateMe };
