const Connection = require('../models/connection.model');
const { HttpError } = require('../errors');
const { SOURCES, getSource } = require('./sources');

// Todos los servicios con el estado de la conexión del usuario (también los no configurados,
// con configured: false, para que la interfaz sepa que existen)
async function list(userId) {
  const rows = await Connection.findAllByUser(userId);
  return SOURCES.map((source) => {
    const conn = rows.find((r) => r.provider === source.id);
    return {
      provider: source.id,
      name: source.name,
      auth: source.auth,
      configured: source.isConfigured(),
      connected: Boolean(conn),
      account: conn?.account ?? null,
      lastSyncAt: conn?.lastSyncAt ?? null,
    };
  });
}

function configuredSource(provider) {
  const source = getSource(provider);
  if (!source.isConfigured()) throw new HttpError(503, `${source.name} no está disponible en este servidor`);
  return source;
}

function connect(userId, provider, body) {
  return configuredSource(provider).connect(userId, body);
}

function sync(userId, provider) {
  return configuredSource(provider).sync(userId);
}

// Se puede desconectar aunque el servicio se haya desactivado después en el servidor
function disconnect(userId, provider) {
  return getSource(provider).disconnect(userId);
}

module.exports = { list, connect, sync, disconnect };
