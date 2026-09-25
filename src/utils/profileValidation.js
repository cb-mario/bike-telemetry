const { HttpError } = require('../errors');
const { parseNumber, parseDate } = require('./validation');

// Campos editables del perfil (null = borrar el valor)
const SEXES = ['male', 'female', 'other'];
const MIN_AGE = 10;
const MAX_AGE = 100;

function parseName(value) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, 'El nombre no puede estar vacío');
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length > 60) throw new HttpError(400, 'El nombre no puede superar 60 caracteres');
  return name;
}

function parseBirthDate(value) {
  const date = parseDate(value, 'birthDate');
  const age = ageOn(date, new Date());
  if (age < MIN_AGE || age > MAX_AGE) {
    throw new HttpError(400, `La edad debe estar entre ${MIN_AGE} y ${MAX_AGE} años`);
  }
  return date;
}

function parseSex(value) {
  if (!SEXES.includes(value)) throw new HttpError(400, `sex debe ser uno de: ${SEXES.join(', ')}`);
  return value;
}

const FIELDS = {
  name: parseName,
  birthDate: parseBirthDate,
  sex: parseSex,
  heightCm: (v) => parseNumber(v, 'heightCm', { min: 100, max: 230, integer: true }),
  weightKg: (v) => Math.round(parseNumber(v, 'weightKg', { min: 30, max: 250 }) * 10) / 10,
  restingHr: (v) => parseNumber(v, 'restingHr', { min: 30, max: 120, integer: true }),
  maxHr: (v) => parseNumber(v, 'maxHr', { min: 100, max: 220, integer: true }),
};

// Edad cumplida en una fecha
function ageOn(birthDate, date) {
  let age = date.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday = date.getUTCMonth() < birthDate.getUTCMonth()
    || (date.getUTCMonth() === birthDate.getUTCMonth() && date.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

// Valida los campos de perfil presentes en `body`; `allowed` limita qué claves se aceptan
function parseProfile(body, { allowed = Object.keys(FIELDS), ignore = [] } = {}) {
  const data = {};
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k) && !ignore.includes(k));
  if (unknown.length) throw new HttpError(400, `Campos no permitidos: ${unknown.join(', ')}`);

  for (const key of allowed) {
    const value = body[key];
    if (value === undefined) continue;
    if (value === null) {
      if (key === 'name') throw new HttpError(400, 'El nombre no puede estar vacío');
      data[key] = null;
      continue;
    }
    data[key] = FIELDS[key](value);
  }
  return data;
}

module.exports = { parseProfile, ageOn, PROFILE_FIELDS: Object.keys(FIELDS) };
