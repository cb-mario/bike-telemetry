const { HttpError } = require('../errors');
const { ROUTING_PROFILES } = require('../services/routing.service');

// Validación de rutas planificadas y de las coordenadas del planificador

const ROUTING_MODES = [...ROUTING_PROFILES, 'straight'];
const MAX_WAYPOINTS = 200;
const MAX_GEOMETRY_POINTS = 50000;

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

module.exports = { parseRoute, parseLatLon, MAX_WAYPOINTS };
