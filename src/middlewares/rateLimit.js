const { rateLimit } = require('express-rate-limit');

const { HttpError } = require('./errorHandler');

const MINUTE = 60 * 1000;

// Limitador por IP con el formato de error { error } de la API
function limiter({ windowMs, limit, message, skipSuccessfulRequests = false, skip }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(skip && { skip }),
    handler: (req, res, next) => next(new HttpError(429, message)),
  });
}

// Límites de las rutas de acceso, contra la fuerza bruta de contraseñas y el alta masiva de cuentas.
// `skip` permite desactivarlos (los tests registran e inician sesión cientos de veces)
function authLimiters({ skip } = {}) {
  return {
    // Solo cuentan los intentos fallidos: quien acierta no gasta intentos
    login: limiter({
      windowMs: 15 * MINUTE,
      limit: 10,
      skipSuccessfulRequests: true,
      skip,
      message: 'Demasiados intentos de inicio de sesión. Espera unos minutos y vuelve a probar',
    }),
    register: limiter({
      windowMs: 60 * MINUTE,
      limit: 10,
      skip,
      message: 'Demasiados registros desde esta conexión. Inténtalo más tarde',
    }),
    exchange: limiter({
      windowMs: 15 * MINUTE,
      limit: 30,
      skipSuccessfulRequests: true,
      skip,
      message: 'Demasiados intentos. Espera unos minutos y vuelve a probar',
    }),
  };
}

module.exports = { authLimiters };
