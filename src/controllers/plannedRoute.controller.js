const plannedRouteService = require('../services/plannedRoute.service');
const { routeLeg } = require('../services/routing.service');
const { HttpError } = require('../errors');
const { parseId, parseLimit } = require('../utils/validation');
const { parseRoute, parseLatLon } = require('../utils/plannedRouteValidation');

const parseRouteId = (value) => parseId(value, 'ID de ruta no válido');

async function leg(req, res) {
  const from = parseLatLon(req.query.from, 'from');
  const to = parseLatLon(req.query.to, 'to');
  res.json(await routeLeg(from, to, req.query.routing));
}

async function list(req, res) {
  res.json(await plannedRouteService.list(req.user.id, { limit: parseLimit(req.query.limit, { max: 100 }) }));
}

async function getById(req, res) {
  res.json(await plannedRouteService.getById(parseRouteId(req.params.id), req.user.id));
}

async function create(req, res) {
  res.status(201).json(await plannedRouteService.create(req.user.id, parseRoute(req.body)));
}

async function update(req, res) {
  res.json(await plannedRouteService.update(parseRouteId(req.params.id), req.user.id, parseRoute(req.body)));
}

async function remove(req, res) {
  await plannedRouteService.remove(parseRouteId(req.params.id), req.user.id);
  res.status(204).end();
}

async function importGpx(req, res) {
  if (!req.file) throw new HttpError(400, 'Adjunta un archivo .gpx en el campo "file"');
  res.status(201).json(await plannedRouteService.importGpx(req.user.id, req.file.buffer, req.file.originalname));
}

async function fromActivity(req, res) {
  const activityId = parseId(req.params.activityId, 'ID de actividad no válido');
  res.status(201).json(await plannedRouteService.fromActivity(req.user.id, activityId));
}

async function gpx(req, res) {
  const { filename, content } = await plannedRouteService.exportGpx(parseRouteId(req.params.id), req.user.id);
  res.set('Content-Type', 'application/gpx+xml; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(content);
}

module.exports = { leg, list, getById, create, update, remove, gpx, importGpx, fromActivity };
