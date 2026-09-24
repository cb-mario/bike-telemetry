const stravaService = require('../services/strava.service');

async function authUrl(req, res) {
  res.json({ url: stravaService.buildAuthUrl(req.user.id) });
}

// Vuelta desde Strava (navegador): siempre redirige al frontend con el resultado
async function callback(req, res) {
  const { code, scope, state, error } = req.query;
  res.redirect(await stravaService.handleCallback({ code, scope, state, error }));
}

async function status(req, res) {
  res.json(await stravaService.status(req.user.id));
}

async function sync(req, res) {
  res.json(await stravaService.sync(req.user.id));
}

async function disconnect(req, res) {
  await stravaService.disconnect(req.user.id);
  res.status(204).end();
}

module.exports = { authUrl, callback, status, sync, disconnect };
