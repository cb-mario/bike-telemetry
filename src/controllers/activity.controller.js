const activityService = require('../services/activity.service');
const { HttpError } = require('../errors');
const {
  parseNumber, parseId: parseNumericId, parseLimit, parseDateRange,
} = require('../utils/validation');
const { parseActivity, SPORT_TYPES } = require('../utils/activityValidation');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parseId = (value) => parseNumericId(value, 'ID de actividad no válido');

const optionalNumber = (value, field, max) => (
  value !== undefined && value !== '' ? parseNumber(Number(value), field, { min: 0, max }) : undefined
);

function parseListQuery(query) {
  const { limit, offset, q, sportType } = query;
  if (q !== undefined && (typeof q !== 'string' || q.length > 100)) throw new HttpError(400, 'q no válido');
  if (sportType !== undefined && !SPORT_TYPES.includes(sportType)) {
    throw new HttpError(400, `sportType debe ser uno de: ${SPORT_TYPES.join(', ')}`);
  }
  const filters = {
    q: q?.trim() || undefined,
    sportType,
    minKm: optionalNumber(query.minKm, 'minKm', 1000),
    maxKm: optionalNumber(query.maxKm, 'maxKm', 1000),
    minElevation: optionalNumber(query.minElevation, 'minElevation', 20000),
    maxElevation: optionalNumber(query.maxElevation, 'maxElevation', 20000),
  };
  if (filters.minKm != null && filters.maxKm != null && filters.minKm > filters.maxKm) {
    throw new HttpError(400, 'minKm no puede ser mayor que maxKm');
  }
  if (filters.minElevation != null && filters.maxElevation != null && filters.minElevation > filters.maxElevation) {
    throw new HttpError(400, 'minElevation no puede ser mayor que maxElevation');
  }
  return {
    ...filters,
    ...parseDateRange(query),
    limit: parseLimit(limit, { max: MAX_LIMIT }) ?? DEFAULT_LIMIT,
    offset: offset !== undefined ? parseNumber(Number(offset), 'offset', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true }) : 0,
  };
}

async function list(req, res) {
  const result = await activityService.list(req.user.id, parseListQuery(req.query));
  res.json(result);
}

async function getById(req, res) {
  const activity = await activityService.getById(parseId(req.params.id), req.user.id);
  res.json(activity);
}

async function create(req, res) {
  const data = parseActivity(req.body, { partial: false });
  const activity = await activityService.create(req.user.id, data);
  res.status(201).json(activity);
}

async function update(req, res) {
  const id = parseId(req.params.id);
  const changes = parseActivity(req.body, { partial: true });
  const activity = await activityService.update(id, req.user.id, changes);
  res.json(activity);
}

// Importa un .gpx (multipart, campo "file"; "title" opcional) y crea la actividad con su track
async function uploadGpx(req, res) {
  if (!req.file) throw new HttpError(400, 'Adjunta un archivo .gpx en el campo "file"');
  const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
  res.status(201).json(await activityService.importGpx(req.user.id, req.file.buffer, title));
}

// Sin ?limit devuelve todas; el planificador pide solo las más recientes
async function routes(req, res) {
  res.json(await activityService.routes(req.user.id, {
    ...parseDateRange(req.query),
    limit: parseLimit(req.query.limit, { max: 500 }),
  }));
}

async function getTrack(req, res) {
  res.json(await activityService.getTrack(parseId(req.params.id), req.user.id));
}

async function remove(req, res) {
  await activityService.remove(parseId(req.params.id), req.user.id);
  res.status(204).end();
}

module.exports = { list, routes, getById, create, uploadGpx, getTrack, update, remove };
