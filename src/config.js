// Configuración leída de las variables de entorno (ver .env.example).
// Son funciones y no constantes para leer siempre el valor actual (los tests lo cambian en caliente)

const { isValidTimeZone } = require('./utils/timezone');

const withoutTrailingSlash = (url) => url.replace(/\/$/, '');

const frontendUrl = () => withoutTrailingSlash(process.env.FRONTEND_URL || 'http://localhost:5173');

const jwtSecret = () => process.env.JWT_SECRET;

function strava() {
  return {
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET,
    redirectUri: process.env.STRAVA_REDIRECT_URI || 'http://localhost:3000/api/strava/callback',
  };
}

function google() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback',
  };
}

// Zona horaria por defecto para días, semanas y meses (el frontend envía la suya en X-Timezone)
const appTimeZone = () => process.env.APP_TIMEZONE || 'Europe/Madrid';

// Correo saliente (recuperación de contraseña). Sin SMTP_HOST los correos se escriben en la consola
function mail() {
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
  };
}

const brouterUrl = () => withoutTrailingSlash(process.env.BROUTER_URL || 'https://brouter.de/brouter');

// Comprobación al arrancar: devuelve los problemas encontrados (vacío si todo está bien)
function configProblems() {
  const problems = [];
  if (!jwtSecret()) problems.push('Falta JWT_SECRET');
  if (!isValidTimeZone(appTimeZone())) {
    problems.push(`APP_TIMEZONE no es una zona horaria válida: ${appTimeZone()}`);
  }
  const { clientId, clientSecret } = strava();
  if (clientId && clientSecret && !/^[0-9a-f]{64}$/i.test(process.env.TOKEN_ENCRYPTION_KEY || '')) {
    problems.push('Strava está configurado pero TOKEN_ENCRYPTION_KEY no es una clave de 64 caracteres hexadecimales');
  }
  return problems;
}

module.exports = { frontendUrl, jwtSecret, strava, google, mail, appTimeZone, brouterUrl, configProblems };
