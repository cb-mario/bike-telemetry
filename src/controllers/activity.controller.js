const activityService = require('../services/activity.service');
const { HttpError } = require('../middlewares/errorHandler');

const HR_MIN = 40;
const HR_MAX = 220;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Reglas por campo: required en creación, nullable = se puede borrar con null
const FIELDS = {
  title: { required: true, parse: parseTitle },
  date: { required: true, parse: parseActivityDate },
  distanceKm: { required: true, parse: (v, f) => parseNumber(v, f, { min: 0, max: 1000, exclusiveMin: true }) },
  durationMin: { required: true, parse: (v, f) => parseNumber(v, f, { min: 1, max: 2880, integer: true }) },
  avgHr: { nullable: true, parse: (v, f) => parseNumber(v, f, { min: HR_MIN, max: HR_MAX, integer: true }) },
  maxHr: { nullable: true, parse: (v, f) => parseNumber(v, f, { min: HR_MIN, max: HR_MAX, integer: true }) },
  elevationGain: { nullable: true, parse: (v, f) => parseNumber(v, f, { min: 0, max: 20000, integer: true }) },
  notes: { nullable: true, parse: parseNotes },
};

function parseTitle(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, 'El título es obligatorio');
  }
  if (value.trim().length > 100) {
    throw new HttpError(400, 'El título no puede superar 100 caracteres');
  }
  return value.trim();
}

function parseNotes(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'Las notas deben ser texto');
  if (value.length > 2000) throw new HttpError(400, 'Las notas no pueden superar 2000 caracteres');
  return value.trim() || null;
}

function parseNumber(value, field, { min, max, integer = false, exclusiveMin = false }) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HttpError(400, `${field} debe ser un número`);
  }
  if (integer && !Number.isInteger(value)) {
    throw new HttpError(400, `${field} debe ser un número entero`);
  }
  if ((exclusiveMin ? value <= min : value < min) || value > max) {
    const lower = exclusiveMin ? `mayor que ${min}` : `al menos ${min}`;
    throw new HttpError(400, `${field} debe ser ${lower} y como máximo ${max}`);
  }
  return value;
}

// ISO 8601: fecha (YYYY-MM-DD) con hora opcional
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

function parseDate(value, field, { endOfDay = false } = {}) {
  const match = typeof value === 'string' && value.match(ISO_DATE_REGEX);
  const date = match && new Date(value);
  const [, year, month, day, time] = match || [];

  // new Date() desborda días imposibles (2026-02-31 → 3 de marzo), así que se comprueba el calendario
  const calendar = match && new Date(Date.UTC(year, month - 1, day));
  const isRealDay = calendar
    && calendar.getUTCFullYear() === Number(year)
    && calendar.getUTCMonth() === month - 1
    && calendar.getUTCDate() === Number(day);

  if (!date || Number.isNaN(date.getTime()) || !isRealDay) {
    throw new HttpError(400, `${field} debe ser una fecha válida (ISO 8601, ej. 2026-09-24)`);
  }
  // Un "to" con solo fecha incluye el día completo
  if (endOfDay && !time) date.setUTCHours(23, 59, 59, 999);
  return date;
}

function parseActivityDate(value, field) {
  const date = parseDate(value, field);
  // Margen de 1 día por diferencias de zona horaria
  if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    throw new HttpError(400, 'La fecha de la actividad no puede estar en el futuro');
  }
  if (date.getUTCFullYear() < 1900) {
    throw new HttpError(400, 'La fecha de la actividad no es válida');
  }
  return date;
}

// Valida el body; en modo parcial (PATCH) solo los campos presentes
function parseActivity(body, { partial }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'El cuerpo de la petición debe ser un objeto JSON');
  }

  const unknown = Object.keys(body).filter((key) => !(key in FIELDS));
  if (unknown.length) {
    throw new HttpError(400, `Campos no permitidos: ${unknown.join(', ')}`);
  }

  const data = {};
  for (const [field, rule] of Object.entries(FIELDS)) {
    const value = body[field];
    if (value === undefined) {
      if (rule.required && !partial) throw new HttpError(400, `${field} es obligatorio`);
      continue;
    }
    if (value === null) {
      if (!rule.nullable) throw new HttpError(400, `${field} no puede ser null`);
      data[field] = null;
      continue;
    }
    data[field] = rule.parse(value, field);
  }

  if (partial && Object.keys(data).length === 0) {
    throw new HttpError(400, 'No hay campos para actualizar');
  }
  return data;
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'ID de actividad no válido');
  return id;
}

function parseListQuery(query) {
  const { from, to, limit, offset } = query;
  const result = {
    from: from !== undefined ? parseDate(from, 'from') : undefined,
    to: to !== undefined ? parseDate(to, 'to', { endOfDay: true }) : undefined,
    limit: limit !== undefined ? parseNumber(Number(limit), 'limit', { min: 1, max: MAX_LIMIT, integer: true }) : DEFAULT_LIMIT,
    offset: offset !== undefined ? parseNumber(Number(offset), 'offset', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true }) : 0,
  };
  if (result.from && result.to && result.from > result.to) {
    throw new HttpError(400, '"from" no puede ser posterior a "to"');
  }
  return result;
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

async function remove(req, res) {
  await activityService.remove(parseId(req.params.id), req.user.id);
  res.status(204).end();
}

module.exports = { list, getById, create, update, remove };
