const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../models/user.model');
const { jwtSecret } = require('../config');
const { toPublicUser, assertHrCoherent } = require('./profile.service');
const { HttpError } = require('../errors');
const { readLoginTicket } = require('../utils/loginTicket');

// Coste de bcrypt configurable (los tests usan uno bajo para ir rápido)
const SALT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;
const JWT_ALGORITHM = 'HS256';
// El mismo secreto firma también el "state" de OAuth y los tickets de login: solo un JWT con
// este propósito sirve como sesión, para que ninguno de los otros pueda usarse en su lugar
const SESSION_PURPOSE = 'session';

// Hash de relleno: si el email no existe se compara igualmente para que el
// tiempo de respuesta no revele qué emails están registrados
const DUMMY_HASH = bcrypt.hashSync('dummy-password', SALT_ROUNDS);

function signToken(user) {
  return jwt.sign({ sub: String(user.id), purpose: SESSION_PURPOSE }, jwtSecret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function verifyToken(token) {
  const payload = jwt.verify(token, jwtSecret(), { algorithms: [JWT_ALGORITHM] });
  if (payload.purpose !== SESSION_PURPOSE) throw new jwt.JsonWebTokenError('No es un token de sesión');
  return payload;
}

async function register(email, password, profile = {}) {
  assertHrCoherent(profile);
  if (await User.findByEmail(email)) {
    throw new HttpError(409, 'El email ya está registrado');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  let user;
  try {
    user = await User.create({ email, passwordHash, ...profile });
  } catch (err) {
    // Registro simultáneo con el mismo email (violación de unicidad)
    if (err.code === 'P2002') throw new HttpError(409, 'El email ya está registrado');
    throw err;
  }

  return { user: toPublicUser(user), token: signToken(user) };
}

async function login(email, password) {
  const user = await User.findByEmail(email);
  // Cuentas sin contraseña (creadas con Strava) comparan contra el hash de relleno y fallan
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) {
    throw new HttpError(401, 'Credenciales inválidas');
  }

  return { user: toPublicUser(await User.findPublicById(user.id)), token: signToken(user) };
}

// Canjea el ticket de "Continuar con Strava/Google" por una sesión normal
async function loginWithTicket(ticket) {
  const data = readLoginTicket(ticket);
  const user = data && (await User.findPublicById(data.userId));
  if (!user) throw new HttpError(401, 'El inicio de sesión ha caducado. Vuelve a intentarlo');
  return { user: toPublicUser(user), token: signToken(user), created: data.created };
}

module.exports = { register, login, loginWithTicket, signToken, verifyToken };
