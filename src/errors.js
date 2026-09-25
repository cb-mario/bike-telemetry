// Error con código HTTP asociado, para lanzarlo desde servicios, validaciones y controladores.
// El middleware errorHandler lo traduce a la respuesta { "error": "..." }
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { HttpError };
