// Fechas de calendario en una zona horaria (IANA, p. ej. "Europe/Madrid") sin dependencias:
// los días, semanas y meses de las estadísticas son los del ciclista, no los de UTC

const formatters = new Map();

function formatterFor(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    }));
  }
  return formatters.get(timeZone);
}

function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone || timeZone.length > 64) return false;
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

// Fecha y hora locales de un instante: { year, month (1-12), day, hour, minute, second }
function localParts(date, timeZone) {
  const parts = {};
  for (const { type, value } of formatterFor(timeZone).formatToParts(date)) {
    if (type !== 'literal') parts[type] = Number(value);
  }
  return parts;
}

// Diferencia (ms) entre la hora local y UTC en ese instante (+2 h en Madrid en verano)
function offsetMs(date, timeZone) {
  const p = localParts(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

// Instante en que empieza el día local year-month-day (month 1-12; se admiten desbordes, p. ej. day 0)
function startOfLocalDay(year, month, day, timeZone) {
  const guess = Date.UTC(year, month - 1, day);
  // Dos pasadas: el desfase puede cambiar entre la estimación y el resultado (cambio de hora)
  let result = guess - offsetMs(new Date(guess), timeZone);
  result = guess - offsetMs(new Date(result), timeZone);
  return new Date(result);
}

// Día local de un instante como { year, month, day }
function localDate(date, timeZone) {
  const { year, month, day } = localParts(date, timeZone);
  return { year, month, day };
}

const pad = (n) => String(n).padStart(2, '0');
const formatLocalDate = ({ year, month, day }) => `${year}-${pad(month)}-${pad(day)}`;

module.exports = { isValidTimeZone, startOfLocalDay, localDate, formatLocalDate };
