const connectionsService = require('../services/connections.service');
const strava = require('../services/sources/strava.source');

async function list(req, res) {
  res.json(await connectionsService.list(req.user.id));
}

// OAuth: { url } a la que llevar al navegador; con credenciales, la conexión ya hecha
async function connect(req, res) {
  res.json(await connectionsService.connect(req.user.id, req.params.provider, req.body));
}

async function sync(req, res) {
  res.json(await connectionsService.sync(req.user.id, req.params.provider));
}

async function disconnect(req, res) {
  await connectionsService.disconnect(req.user.id, req.params.provider);
  res.status(204).end();
}

// Vuelta desde Strava (navegador): siempre redirige al frontend con el resultado
async function stravaCallback(req, res) {
  const { code, scope, state, error } = req.query;
  res.redirect(await strava.handleCallback({ code, scope, state, error }));
}

module.exports = { list, connect, sync, disconnect, stravaCallback };
