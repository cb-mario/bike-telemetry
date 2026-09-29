const bcrypt = require('bcrypt');
const { waitUntil } = require('@vercel/functions');
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
  // Cuentas sin contraseña (creadas con Google) comparan contra el hash de relleno y fallan
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) {
    throw new HttpError(401, 'Credenciales inválidas');
  }

  return { user: toPublicUser(await User.findPublicById(user.id)), token: signToken(user) };
}

// Canjea el ticket de "Continuar con Google" por una sesión normal
async function loginWithTicket(ticket) {
  const data = readLoginTicket(ticket);
  const user = data && (await User.findPublicById(data.userId));
  if (!user) throw new HttpError(401, 'El inicio de sesión ha caducado. Vuelve a intentarlo');
  return { user: toPublicUser(user), token: signToken(user), created: data.created };
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Correo de recuperación: HTML con botón (colores de la app) y texto plano para clientes sin HTML
function passwordResetEmail({ name, link }) {
  const hello = `Hola${name ? ` ${name}` : ''}:`;
  const text = `${hello}\n\n`
    + `Para elegir una contraseña nueva abre este enlace (caduca en 30 minutos y solo sirve una vez):\n\n${link}\n\n`
    + 'Si no lo has pedido tú, ignora este correo: tu contraseña no cambia.';
  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:32px 16px;background:#080d1c;font-family:Arial,Helvetica,sans-serif;color:#f5f8ff">
  <div style="max-width:480px;margin:0 auto;background:#131d3b;border:1px solid #222e55;border-radius:12px;padding:32px">
    <p style="margin:0 0 24px;font-size:18px;font-weight:bold">Bike<span style="color:#94a3cc">Telemetry</span></p>
    <p style="margin:0 0 12px;font-size:15px">${escapeHtml(hello)}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#c8d2ee">Has pedido restablecer tu contraseña. Pulsa el botón para elegir una nueva. El enlace caduca en 30 minutos y solo sirve una vez.</p>
    <a href="${escapeHtml(link)}" style="display:inline-block;background:#d4ff3a;color:#080d1c;font-weight:bold;font-size:15px;text-decoration:none;padding:12px 20px;border-radius:8px">Elegir contraseña nueva</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#94a3cc">Si no lo has pedido tú, ignora este correo: tu contraseña no cambia.</p>
  </div>
</body></html>`;
  return { text, html };
}

// "He olvidado mi contraseña": envía el enlace si el email tiene cuenta. Quien llama no sabe si
// existe (misma respuesta y el envío no se espera, para que el tiempo tampoco lo delate).
// En Vercel, waitUntil mantiene viva la función hasta que sale el correo (si no, se congela
// al responder y el envío se pierde); fuera de Vercel no hace nada.
// Una cuenta creada con Google también puede usarlo para ponerse contraseña
async function requestPasswordReset(email) {
  const user = await User.findByEmail(email);
  if (!user) return;

  // El token va en el fragmento (#): no llega a ningún servidor ni queda en los logs
  const link = `${frontendUrl()}/restablecer#token=${encodeURIComponent(issuePasswordResetToken(user))}`;
  waitUntil(sendMail({
    to: user.email,
    subject: 'Restablece tu contraseña de BikeTelemetry',
    ...passwordResetEmail({ name: user.name, link }),
  }).catch((err) => console.error('No se pudo enviar el correo de recuperación:', err)));
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

// Cambio de contraseña desde el perfil. Con contraseña hay que dar la actual; una cuenta creada
// con Google puede ponerse una
async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findCredentialsById(userId);
  if (!user) throw new HttpError(404, 'Usuario no encontrado');

  if (user.passwordHash) {
    // 400 y no 401: la sesión es válida, lo que falla es el dato del formulario
    if (typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new HttpError(400, 'La contraseña actual no es correcta');
    }
  }

  return toPublicUser(await User.updatePassword(userId, await bcrypt.hash(newPassword, SALT_ROUNDS)));
}

module.exports = {
  register, login, loginWithTicket, requestPasswordReset, resetPassword, changePassword, signToken, verifyToken,
};
