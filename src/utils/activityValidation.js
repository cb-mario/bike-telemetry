const { HttpError } = require('../errors');
const { parseNumber, parseDate } = require('./validation');

// Validación de actividades, compartida por la API (manual/GPX) y la sincronización con Strava

const HR_MIN = 40;
const HR_MAX = 220;

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
  sportType: { nullable: true, parse: parseSportType },
  maxSpeedKmh: { nullable: true, parse: (v, f) => parseNumber(v, f, { min: 0, max: 150 }) },
};

// Tipos de salida (mismos identificadores que sport_type de Strava)
const SPORT_TYPES = ['Ride', 'GravelRide', 'MountainBikeRide', 'VirtualRide', 'EBikeRide', 'EMountainBikeRide'];

function parseSportType(value, field) {
  if (!SPORT_TYPES.includes(value)) {
    throw new HttpError(400, `${field} debe ser uno de: ${SPORT_TYPES.join(', ')}`);
  }
  return value;
}

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

module.exports = { parseActivity, SPORT_TYPES, HR_MIN, HR_MAX };
