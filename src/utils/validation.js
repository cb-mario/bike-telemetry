const { HttpError } = require('../errors');
const { startOfLocalDay } = require('./timezone');

// Validadores compartidos por los controladores

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

// Identificador numérico de la URL (/:id)
function parseId(value, message = 'ID no válido') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, message);
  return id;
}

// ?limit= opcional (undefined si no viene)
function parseLimit(value, { max }) {
  return value !== undefined ? parseNumber(Number(value), 'limit', { min: 1, max, integer: true }) : undefined;
}

// ISO 8601: fecha (YYYY-MM-DD) con hora opcional
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

// Con `timeZone`, una fecha sin hora es el comienzo (o con endOfDay, el final) de ese día en la zona;
// sin ella, en UTC. Una fecha con hora es siempre ese instante
function parseDate(value, field, { endOfDay = false, timeZone } = {}) {
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
  if (time) return date;
  if (timeZone) {
    return endOfDay
      ? new Date(startOfLocalDay(Number(year), Number(month), Number(day) + 1, timeZone).getTime() - 1)
      : startOfLocalDay(Number(year), Number(month), Number(day), timeZone);
  }
  // Un "to" con solo fecha incluye el día completo
  if (endOfDay) date.setUTCHours(23, 59, 59, 999);
  return date;
}

// Rango opcional ?from=&to= de la query, con los días de la zona horaria indicada
// ("to" con solo fecha incluye el día completo)
function parseDateRange({ from, to }, timeZone) {
  const range = {
    from: from !== undefined ? parseDate(from, 'from', { timeZone }) : undefined,
    to: to !== undefined ? parseDate(to, 'to', { endOfDay: true, timeZone }) : undefined,
  };
  if (range.from && range.to && range.from > range.to) {
    throw new HttpError(400, '"from" no puede ser posterior a "to"');
  }
  return range;
}

module.exports = { parseNumber, parseId, parseLimit, parseDate, parseDateRange };
