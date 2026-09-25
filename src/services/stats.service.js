const Activity = require('../models/activity.model');
const User = require('../models/user.model');
const { HttpError } = require('../errors');
const { estimatesFor } = require('./profile.service');
const { round } = require('../utils/number');
const { startOfLocalDay, localDate, formatLocalDate } = require('../utils/timezone');

const DEFAULT_BUCKETS = 12;
const MAX_BUCKETS = 400;

// Modelo de 5 zonas por % de la FC máxima
const HR_ZONES = [
  { zone: 1, name: 'Recuperación', minPct: 0.5 },
  { zone: 2, name: 'Resistencia aeróbica', minPct: 0.6 },
  { zone: 3, name: 'Tempo', minPct: 0.7 },
  { zone: 4, name: 'Umbral', minPct: 0.8 },
  { zone: 5, name: 'VO2 máx', minPct: 0.9 },
];


// Agregados comunes a resumen y evolución
function aggregate(activities) {
  const totals = { count: activities.length, distanceKm: 0, durationMin: 0, elevationGain: 0 };
  let hrWeighted = 0;
  let hrDuration = 0;

  for (const a of activities) {
    totals.distanceKm += a.distanceKm;
    totals.durationMin += a.durationMin;
    totals.elevationGain += a.elevationGain ?? 0;
    if (a.avgHr != null) {
      hrWeighted += a.avgHr * a.durationMin;
      hrDuration += a.durationMin;
    }
  }

  return {
    count: totals.count,
    distanceKm: round(totals.distanceKm, 2),
    durationMin: totals.durationMin,
    elevationGain: totals.elevationGain,
    avgSpeedKmh: totals.durationMin ? round(totals.distanceKm / (totals.durationMin / 60)) : null,
    // FC media ponderada por la duración de cada actividad
    avgHr: hrDuration ? Math.round(hrWeighted / hrDuration) : null,
  };
}

function pickRecord(activities, field) {
  const best = activities.reduce((top, a) => ((a[field] ?? -1) > (top?.[field] ?? -1) ? a : top), null);
  if (!best || best[field] == null) return null;
  return { id: best.id, title: best.title, date: best.date, [field]: best[field] };
}

// Resumen de unas actividades ya filtradas por el rango
function summarize(activities, { from, to }) {
  const totals = aggregate(activities);
  const recordedMaxHr = activities.reduce((max, a) => Math.max(max, a.maxHr ?? 0), 0);

  return {
    from: from ?? null,
    to: to ?? null,
    ...totals,
    avgDistanceKm: totals.count ? round(totals.distanceKm / totals.count, 2) : null,
    avgDurationMin: totals.count ? Math.round(totals.durationMin / totals.count) : null,
    maxHr: recordedMaxHr || null,
    records: {
      longestDistance: pickRecord(activities, 'distanceKm'),
      longestDuration: pickRecord(activities, 'durationMin'),
      biggestClimb: pickRecord(activities, 'elevationGain'),
    },
  };
}

async function summary(userId, { from, to }) {
  return summarize(await Activity.findForStats({ userId, from, to }), { from, to });
}

// Resumen de todo el historial, del mes en curso y del mismo tramo del mes anterior (del día 1 al
// día de hoy, recortado si el mes anterior es más corto), con los días de la zona del usuario.
// Una sola lectura de la BD en lugar de tres peticiones
async function overview(userId, { timeZone, now = new Date() }) {
  const today = localDate(now, timeZone);
  const prev = { year: today.month === 1 ? today.year - 1 : today.year, month: today.month === 1 ? 12 : today.month - 1 };
  const prevLastDay = new Date(Date.UTC(today.year, today.month - 1, 0)).getUTCDate();

  const monthFrom = startOfLocalDay(today.year, today.month, 1, timeZone);
  const prevFrom = startOfLocalDay(prev.year, prev.month, 1, timeZone);
  const prevTo = new Date(startOfLocalDay(prev.year, prev.month, Math.min(today.day, prevLastDay) + 1, timeZone) - 1);

  const all = await Activity.findForStats({ userId });
  const within = (from, to) => all.filter((a) => a.date >= from && (!to || a.date <= to));
  return {
    total: summarize(all, {}),
    month: summarize(within(monthFrom), { from: monthFrom }),
    prevMonth: summarize(within(prevFrom, prevTo), { from: prevFrom, to: prevTo }),
    monthStart: formatLocalDate({ ...today, day: 1 }),
    prevMonthStart: formatLocalDate({ ...prev, day: 1 }),
  };
}

// Inicio del periodo en la zona del usuario: lunes de la semana o día 1 del mes (a las 00:00),
// y el periodo `shift` posiciones después (o antes, si es negativo)
function startOfPeriod(date, period, timeZone, shift = 0) {
  const { year, month, day } = localDate(date, timeZone);
  if (period === 'month') return startOfLocalDay(year, month + shift, 1, timeZone);
  const daysSinceMonday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return startOfLocalDay(year, month, day - daysSinceMonday + shift * 7, timeZone);
}

async function evolution(userId, { period, from, to, timeZone }) {
  const rangeTo = to ?? new Date();
  // Por defecto: los últimos 12 periodos hasta hoy
  const rangeFrom = from ?? startOfPeriod(rangeTo, period, timeZone, -(DEFAULT_BUCKETS - 1));

  // Periodos consecutivos, incluidos los vacíos, para poder dibujar la serie directamente
  const buckets = [];
  for (
    let start = startOfPeriod(rangeFrom, period, timeZone);
    start <= rangeTo;
    start = startOfPeriod(start, period, timeZone, 1)
  ) {
    if (buckets.length >= MAX_BUCKETS) {
      throw new HttpError(400, `Rango demasiado amplio: máximo ${MAX_BUCKETS} periodos`);
    }
    buckets.push({ start, activities: [] });
  }

  const activities = await Activity.findForStats({ userId, from: rangeFrom, to: rangeTo });
  let index = 0;
  for (const a of activities) {
    while (index < buckets.length - 1 && a.date >= buckets[index + 1].start) index++;
    buckets[index].activities.push(a);
  }

  return {
    period,
    from: rangeFrom,
    to: rangeTo,
    buckets: buckets.map((b) => ({
      periodStart: formatLocalDate(localDate(b.start, timeZone)),
      ...aggregate(b.activities),
    })),
  };
}

// FC máxima de referencia: la del perfil o, en su defecto, la mayor registrada
async function resolveMaxHr(userId) {
  const user = await User.findPublicById(userId);
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  if (user.maxHr) return { maxHr: user.maxHr, source: 'profile' };

  // Sin FC máx. en el perfil: la mayor entre la registrada en salidas y la estimada por edad
  // (la registrada en salidas suaves suele quedarse corta)
  const recorded = await Activity.maxRecordedHr(userId);
  const byAge = estimatesFor(user).maxHr;
  if (byAge && (!recorded || byAge > recorded)) return { maxHr: byAge, source: 'age' };
  if (recorded) return { maxHr: recorded, source: 'activities' };
  return { maxHr: null, source: null };
}

function buildZones(maxHr) {
  return HR_ZONES.map((z, i) => {
    const next = HR_ZONES[i + 1];
    return {
      zone: z.zone,
      name: z.name,
      minBpm: Math.round(z.minPct * maxHr),
      maxBpm: next ? Math.round(next.minPct * maxHr) - 1 : maxHr,
    };
  });
}

// Reparte las actividades por zona según su FC media
// (sin datos segundo a segundo, cada actividad cuenta entera en la zona de su FC media)
async function hrZones(userId, { from, to }) {
  const { maxHr, source } = await resolveMaxHr(userId);
  const activities = await Activity.findForStats({ userId, from, to });
  const withHr = activities.filter((a) => a.avgHr != null);

  const base = {
    from: from ?? null,
    to: to ?? null,
    maxHr,
    maxHrSource: source,
    activitiesWithHr: withHr.length,
    activitiesWithoutHr: activities.length - withHr.length,
  };
  if (!maxHr) return { ...base, zones: null };

  const zones = buildZones(maxHr).map((z) => ({ ...z, count: 0, durationMin: 0, distanceKm: 0 }));
  for (const a of withHr) {
    // Por debajo de Z1 cuenta como Z1; por encima de la FC máx, como Z5
    const zone = [...zones].reverse().find((z) => a.avgHr >= z.minBpm) ?? zones[0];
    zone.count += 1;
    zone.durationMin += a.durationMin;
    zone.distanceKm += a.distanceKm;
  }

  const totalDuration = zones.reduce((sum, z) => sum + z.durationMin, 0);
  return {
    ...base,
    zones: zones.map((z) => ({
      ...z,
      distanceKm: round(z.distanceKm, 2),
      percentTime: totalDuration ? round((z.durationMin / totalDuration) * 100) : 0,
    })),
  };
}

module.exports = { summary, overview, evolution, hrZones };
