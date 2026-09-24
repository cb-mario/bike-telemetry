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
  // Los HttpError son intencionados (p. ej. 502/503 de Strava) y su mensaje es seguro;
  // cualquier otro 5xx es inesperado: se registra y se oculta el detalle al cliente
  const expected = err instanceof HttpError;
  if (status >= 500 && !expected) console.error(err);

  let message = err.message;
  if (status >= 500 && !expected) message = 'Error interno del servidor';
  else if (err.type === 'entity.parse.failed') message = 'JSON mal formado';

  res.status(status).json({ error: message });
}

module.exports = { HttpError, notFound, errorHandler };
