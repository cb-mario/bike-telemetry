const { verifyToken } = require('../services/auth.service');
const { HttpError } = require('./errorHandler');

// Exige un JWT válido en "Authorization: Bearer <token>" y expone req.user = { id }
function authMiddleware(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Token de autenticación requerido'));
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: Number(payload.sub) };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido';
    next(new HttpError(401, message));
  }
}

module.exports = authMiddleware;
