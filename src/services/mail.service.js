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

// Envía un correo por SMTP. Sin SMTP configurado (desarrollo) lo escribe en la consola
async function sendMail({ to, subject, text, html }) {
  if (process.env.NODE_ENV === 'test') {
    testOutbox.push({ to, subject, text, html });
    return;
  }
  if (!mail().host) {
    console.warn(`[correo sin SMTP_HOST] Para: ${to}\nAsunto: ${subject}\n\n${text}\n`);
    return;
  }
  await getTransport().sendMail({ from: mail().from, to, subject, text, html });
}

module.exports = { sendMail, testOutbox };
