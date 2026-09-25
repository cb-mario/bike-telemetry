const plannedRouteService = require('../services/plannedRoute.service');
const { routeLeg, ROUTING_PROFILES } = require('../services/routing.service');
const { HttpError } = require('../middlewares/errorHandler');
const { parseNumber } = require('../utils/validation');

const ROUTING_MODES = [...ROUTING_PROFILES, 'straight'];
const MAX_WAYPOINTS = 200;
const MAX_GEOMETRY_POINTS = 50000;

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'ID de ruta no válido');
  return id;
}

const isLat = (v) => typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
const isLon = (v) => typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;
const isEle = (v) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= -500 && v <= 9000);

function parsePoints(value, field, { min, max, withElevation }) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new HttpError(400, `${field} debe tener entre ${min} y ${max} puntos`);
  }
  return value.map((p) => {
    const valid = Array.isArray(p) && isLat(p[0]) && isLon(p[1])
      && (withElevation ? p.length <= 3 && isEle(p[2] ?? null) : p.length === 2);
    if (!valid) throw new HttpError(400, `${field} contiene puntos no válidos`);
    return withElevation ? [p[0], p[1], p[2] ?? null] : [p[0], p[1]];
  });
}

// Valida { name, routing, waypoints, geometry }
function parseRoute(body) {
  const { name, routing, waypoints, geometry } = body || {};
  if (typeof name !== 'string' || !name.trim()) throw new HttpError(400, 'El nombre es obligatorio');
  if (name.trim().length > 100) throw new HttpError(400, 'El nombre no puede superar 100 caracteres');
  if (!ROUTING_MODES.includes(routing)) throw new HttpError(400, `routing debe ser uno de: ${ROUTING_MODES.join(', ')}`);
  return {
    name: name.trim(),
    routing,
    waypoints: parsePoints(waypoints, 'waypoints', { min: 2, max: MAX_WAYPOINTS, withElevation: false }),
    geometry: parsePoints(geometry, 'geometry', { min: 2, max: MAX_GEOMETRY_POINTS, withElevation: true }),
  };
}

// "lat,lon" → [lat, lon]
function parseLatLon(value, field) {
  const parts = typeof value === 'string' ? value.split(',').map(Number) : [];
  if (parts.length !== 2 || !isLat(parts[0]) || !isLon(parts[1])) {
    throw new HttpError(400, `${field} debe tener el formato "lat,lon"`);
  }
  return parts;
}

async function leg(req, res) {
  const from = parseLatLon(req.query.from, 'from');
  const to = parseLatLon(req.query.to, 'to');
  res.json(await routeLeg(from, to, req.query.routing));
}

async function list(req, res) {
  const { limit } = req.query;
  const options = limit !== undefined
    ? { limit: parseNumber(Number(limit), 'limit', { min: 1, max: 100, integer: true }) }
    : {};
  res.json(await plannedRouteService.list(req.user.id, options));
}

async function getById(req, res) {
  res.json(await plannedRouteService.getById(parseId(req.params.id), req.user.id));
}

async function create(req, res) {
  res.status(201).json(await plannedRouteService.create(req.user.id, parseRoute(req.body)));
}

async function update(req, res) {
  res.json(await plannedRouteService.update(parseId(req.params.id), req.user.id, parseRoute(req.body)));
}

async function remove(req, res) {
  await plannedRouteService.remove(parseId(req.params.id), req.user.id);
  res.status(204).end();
}

async function importGpx(req, res) {
  if (!req.file) throw new HttpError(400, 'Adjunta un archivo .gpx en el campo "file"');
  res.status(201).json(await plannedRouteService.importGpx(req.user.id, req.file.buffer, req.file.originalname));
}

async function fromActivity(req, res) {
  const activityId = Number(req.params.activityId);
  if (!Number.isInteger(activityId) || activityId <= 0) throw new HttpError(400, 'ID de actividad no válido');
  res.status(201).json(await plannedRouteService.fromActivity(req.user.id, activityId));
}

async function gpx(req, res) {
  const { filename, content } = await plannedRouteService.exportGpx(parseId(req.params.id), req.user.id);
  res.set('Content-Type', 'application/gpx+xml; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(content);
}

module.exports = { leg, list, getById, create, update, remove, gpx, importGpx, fromActivity };
