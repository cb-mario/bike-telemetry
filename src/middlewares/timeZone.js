const { appTimeZone } = require('../config');
const { isValidTimeZone } = require('../utils/timezone');

// Zona horaria del usuario (cabecera X-Timezone que envía el frontend) en req.timeZone.
// Si falta o no es válida se usa la de la app: nunca falla la petición por esto
function timeZone(req, res, next) {
  const header = req.get('X-Timezone');
  req.timeZone = isValidTimeZone(header) ? header : appTimeZone();
  next();
}

module.exports = timeZone;
