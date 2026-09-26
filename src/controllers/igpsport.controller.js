const igpsportService = require('../services/igpsport.service');

async function status(req, res) {
  res.json(await igpsportService.status(req.user.id));
}

// { email, password } de la cuenta de iGPSPORT; la contraseña no se guarda
async function connect(req, res) {
  const { email, password } = req.body ?? {};
  res.json(await igpsportService.connect(req.user.id, { email, password }));
}

async function sync(req, res) {
  res.json(await igpsportService.sync(req.user.id));
}

async function disconnect(req, res) {
  await igpsportService.disconnect(req.user.id);
  res.status(204).end();
}

module.exports = { status, connect, sync, disconnect };
