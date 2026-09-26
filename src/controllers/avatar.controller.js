const profileService = require('../services/profile.service');
const User = require('../models/user.model');
const { HttpError } = require('../errors');

async function upload(req, res) {
  res.json({ user: await profileService.setAvatar(req.user.id, req.file.buffer) });
}

async function remove(req, res) {
  res.json({ user: await profileService.removeAvatar(req.user.id) });
}

// Pública: la pide una etiqueta <img>, que no envía el token. El id es aleatorio y cambia en
// cada subida, así que la respuesta no cambia nunca y se puede cachear un año
async function show(req, res) {
  const avatar = await User.findAvatar(req.params.id);
  if (!avatar) throw new HttpError(404, 'Foto no encontrada');
  res.set({ 'Content-Type': avatar.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' });
  res.send(Buffer.from(avatar.data));
}

module.exports = { upload, remove, show };
