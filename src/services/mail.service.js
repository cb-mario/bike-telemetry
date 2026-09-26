const nodemailer = require('nodemailer');

const { mail } = require('../config');

// Correos enviados en los tests (no salen del proceso)
const testOutbox = [];

let transport;
function getTransport() {
  const { host, port, user, pass } = mail();
  transport ??= nodemailer.createTransport({ host, port, secure: port === 465, auth: user ? { user, pass } : undefined });
  return transport;
}

// Envía un correo por SMTP. Sin SMTP configurado lo escribe en la consola (en desarrollo) o falla (en producción)
async function sendMail({ to, subject, text, html }) {
  if (process.env.NODE_ENV === 'test') {
    testOutbox.push({ to, subject, text, html });
    return;
  }
  if (!mail().host) {
    // En producción el correo lleva enlaces de un solo uso: no se escriben en los logs
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Falta SMTP_HOST: no se ha enviado "${subject}" (configura SMTP_* en las variables de entorno)`);
    }
    console.warn(`[correo sin SMTP_HOST] Para: ${to}\nAsunto: ${subject}\n\n${text}\n`);
    return;
  }
  await getTransport().sendMail({ from: mail().from, to, subject, text, html });
}

module.exports = { sendMail, testOutbox };
