const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../models/user.model');
const { jwtSecret } = require('../config');
const { toPublicUser, assertHrCoherent } = require('./profile.service');
const { HttpError } = require('../errors');
const { readLoginTicket } = require('../utils/loginTicket');
const { issuePasswordResetToken, readPasswordResetToken, fingerprint } = require('../utils/passwordResetToken');
const { frontendUrl } = require('../config');
const { sendMail } = require('./mail.service');

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

// "He olvidado mi contraseña": envía el enlace si el email tiene cuenta. Quien llama no sabe si
// existe (misma respuesta y el envío no se espera, para que el tiempo tampoco lo delate).
// Una cuenta creada con Google también puede usarlo para ponerse contraseña
async function requestPasswordReset(email) {
  const user = await User.findByEmail(email);
  if (!user) return;

  // El token va en el fragmento (#): no llega a ningún servidor ni queda en los logs
  const link = `${frontendUrl()}/restablecer#token=${encodeURIComponent(issuePasswordResetToken(user))}`;
  sendMail({
    to: user.email,
    subject: 'Restablece tu contraseña de BikeTelemetry',
    text: `Hola${user.name ? ` ${user.name}` : ''}:\n\n`
      + `Para elegir una contraseña nueva abre este enlace (caduca en 30 minutos y solo sirve una vez):\n\n${link}\n\n`
      + 'Si no lo has pedido tú, ignora este correo: tu contraseña no cambia.',
  }).catch((err) => console.error('No se pudo enviar el correo de recuperación:', err));
}

// Cambia la contraseña con el enlace del correo y abre sesión
async function resetPassword(token, password) {
  const data = readPasswordResetToken(token);
  const user = data && (await User.findCredentialsById(data.userId));
  if (!user || fingerprint(user.passwordHash) !== data.fingerprint) {
    throw new HttpError(400, 'El enlace no es válido o ha caducado. Pide uno nuevo');
  }

  const updated = await User.updatePassword(user.id, await bcrypt.hash(password, SALT_ROUNDS));
  return { user: toPublicUser(updated), token: signToken(updated) };
}

module.exports = { register, login, loginWithTicket, requestPasswordReset, resetPassword, signToken, verifyToken };
