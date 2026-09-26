const crypto = require('node:crypto');

const { signPurpose, readPurpose } = require('./signedToken');

// Enlace de "He olvidado mi contraseña". Lleva una huella del hash actual de la contraseña:
// en cuanto se cambia, la huella deja de coincidir y el enlace no vuelve a servir (un solo uso)
const PURPOSE = 'password-reset';
const TTL = '30m';

const fingerprint = (passwordHash) =>
  crypto.createHash('sha256').update(passwordHash ?? '').digest('base64url').slice(0, 16);

function issuePasswordResetToken(user) {
  return signPurpose(PURPOSE, { sub: String(user.id), v: fingerprint(user.passwordHash) }, TTL);
}

// { userId, fingerprint } o null si el token no es válido, ha caducado o es de otro tipo
function readPasswordResetToken(token) {
  const payload = readPurpose(token, PURPOSE);
  return payload && { userId: Number(payload.sub), fingerprint: payload.v };
}

module.exports = { issuePasswordResetToken, readPasswordResetToken, fingerprint };
