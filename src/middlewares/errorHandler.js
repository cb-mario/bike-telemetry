// Error con código HTTP asociado, para lanzarlo desde servicios y controladores
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Rutas no encontradas → 404 con formato JSON uniforme
function notFound(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// Manejador de errores centralizado → { "error": "..." }
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  let message = err.message;
  if (status >= 500) message = 'Error interno del servidor';
  else if (err.type === 'entity.parse.failed') message = 'JSON mal formado';

  res.status(status).json({ error: message });
}

module.exports = { HttpError, notFound, errorHandler };
