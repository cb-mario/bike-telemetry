const crypto = require('node:crypto');

// Cifrado simétrico AES-256-GCM para secretos guardados en la BD (tokens de Strava)
// Formato: v1:<iv base64>:<tag base64>:<datos base64>

function getKey() {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error('TOKEN_ENCRYPTION_KEY debe ser una clave de 32 bytes en hexadecimal (64 caracteres)');
  }
  return Buffer.from(hex, 'hex');
}

function encrypt(plain) {
  if (plain == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

function decrypt(payload) {
  if (payload == null) return null;
  const [version, iv, tag, data] = payload.split(':');
  if (version !== 'v1') throw new Error('Formato de secreto cifrado desconocido');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
