const { HttpError } = require('../errors');
const { computeStats, buildTrack, summaryPolyline } = require('./track.service');
const { round } = require('../utils/number');
// Lecturas de pulso fuera del rango válido se consideran artefactos del sensor
const { HR_MIN, HR_MAX } = require('../utils/activityValidation');

// Archivos .fit de ciclocomputadores (Garmin, Wahoo, Hammerhead, Bryton...) con el SDK oficial de Garmin

// Los FIT guardan la posición en semicírculos: 2^31 semicírculos = 180°
const SEMICIRCLE_TO_DEG = 180 / 2 ** 31;
// Un hueco mayor entre registros (pausa o autopausa) abre un segmento nuevo, como en un GPX
const SEGMENT_GAP_S = 60;

// Tipo de salida (identificadores de Strava) según el deporte y subdeporte del FIT
const SUB_SPORT_TYPES = {
  mountain: 'MountainBikeRide',
  downhill: 'MountainBikeRide',
  gravelCycling: 'GravelRide',
  cyclocross: 'GravelRide',
  indoorCycling: 'VirtualRide',
  virtualActivity: 'VirtualRide',
  spin: 'VirtualRide',
  eBikeMountain: 'EMountainBikeRide',
  eBikeEnduro: 'EMountainBikeRide',
};

function sportTypeOf(sport, subSport) {
  if (sport === 'eBiking') return subSport === 'eBikeMountain' || subSport === 'eBikeEnduro' ? 'EMountainBikeRide' : 'EBikeRide';
  return SUB_SPORT_TYPES[subSport] ?? 'Ride';
}

// El SDK es un módulo ES: se carga una vez bajo demanda desde CommonJS
let sdk;
const loadSdk = () => (sdk ??= import('@garmin/fitsdk'));

const finite = (v) => (Number.isFinite(v) ? v : null);
const validHr = (v) => (Number.isFinite(v) && v >= HR_MIN && v <= HR_MAX ? Math.round(v) : null);

// Decodifica el binario y devuelve los mensajes del FIT
async function decodeFit(buffer) {
  const { Decoder, Stream } = await loadSdk();
  let decoder;
  try {
    decoder = new Decoder(Stream.fromBuffer(buffer));
    if (!decoder.isFIT()) throw new Error('no FIT');
  } catch {
    throw new HttpError(400, 'El archivo no es un FIT válido');
  }
  if (!decoder.checkIntegrity()) {
    throw new HttpError(400, 'El archivo FIT está dañado o incompleto');
  }
  const { messages, errors } = decoder.read({ convertDateTimesToDates: true, includeUnknownData: false });
  if (errors.length && !messages.recordMesgs?.length && !messages.sessionMesgs?.length) {
    throw new HttpError(400, 'El archivo no es un FIT válido');
  }
  return messages;
}

// Registros con posición → segmentos [{ lat, lon, ele, time, hr }], cortando en las pausas
function recordsToSegments(records = []) {
  const segments = [];
  let current = [];
  let lastTime = null;

  for (const r of records) {
    if (!Number.isFinite(r.positionLat) || !Number.isFinite(r.positionLong)) continue;
    const time = r.timestamp instanceof Date ? r.timestamp.getTime() : null;
    if (time != null && lastTime != null && (time - lastTime) / 1000 > SEGMENT_GAP_S) {
      if (current.length >= 2) segments.push(current);
      current = [];
    }
    current.push({
      lat: r.positionLat * SEMICIRCLE_TO_DEG,
      lon: r.positionLong * SEMICIRCLE_TO_DEG,
      ele: finite(r.enhancedAltitude ?? r.altitude),
      time,
      hr: validHr(r.heartRate),
    });
    if (time != null) lastTime = time;
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

// Suma los totales de las sesiones del archivo (normalmente una por salida)
function sessionTotals(sessions) {
  if (!sessions.length) return null;
  const sum = (key) => {
    const values = sessions.map((s) => s[key]).filter(Number.isFinite);
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  };
  const max = (key) => {
    const values = sessions.map((s) => s[key]).filter(Number.isFinite);
    return values.length ? Math.max(...values) : null;
  };
  // FC media ponderada por el tiempo de cada sesión
  const hrSessions = sessions.filter((s) => Number.isFinite(s.avgHeartRate) && Number.isFinite(s.totalTimerTime));
  const hrTime = hrSessions.reduce((a, s) => a + s.totalTimerTime, 0);
  const avgHr = hrTime ? hrSessions.reduce((a, s) => a + s.avgHeartRate * s.totalTimerTime, 0) / hrTime : null;
  const maxSpeed = max('enhancedMaxSpeed') ?? max('maxSpeed');
  const startTimes = sessions.map((s) => s.startTime).filter((d) => d instanceof Date);

  return {
    distanceM: sum('totalDistance'),
    // Tiempo en movimiento; si no está, el de cronómetro
    movingS: sum('totalMovingTime') ?? sum('totalTimerTime'),
    elevationGain: sum('totalAscent'),
    avgHr: validHr(avgHr),
    maxHr: validHr(max('maxHeartRate')),
    maxSpeedKmh: maxSpeed != null ? maxSpeed * 3.6 : null,
    startTime: startTimes.length ? new Date(Math.min(...startTimes.map((d) => d.getTime()))) : null,
  };
}

// Analiza un FIT: devuelve las métricas, el tipo de salida y, si hay GPS, el track a guardar
async function analyzeFit(buffer) {
  const messages = await decodeFit(buffer);
  const sessions = messages.sessionMesgs ?? [];
  const fileType = messages.fileIdMesgs?.[0]?.type;

  if (fileType && fileType !== 'activity') {
    throw new HttpError(400, 'El FIT no es una actividad grabada (puede ser una ruta, un entrenamiento o una configuración)');
  }
  const { sport, subSport } = sessions[0] ?? messages.sportMesgs?.[0] ?? {};
  if (sport && sport !== 'cycling' && sport !== 'eBiking') {
    throw new HttpError(400, 'El FIT no es una salida en bici');
  }

  const segments = recordsToSegments(messages.recordMesgs);
  const fromTrack = segments.length ? computeStats(segments) : null;
  const totals = sessionTotals(sessions);
  if (!fromTrack && !totals) {
    throw new HttpError(400, 'El FIT no contiene datos de la salida');
  }

  // Los totales del propio ciclocomputador mandan (sensores de velocidad, barómetro);
  // lo calculado sobre el track cubre los campos que falten
  const pick = (fromSession, fromGps) => fromSession ?? fromGps ?? null;
  const stats = {
    distanceKm: pick(totals?.distanceM != null ? round(totals.distanceM / 1000, 2) : null, fromTrack?.distanceKm),
    durationMin: pick(totals?.movingS != null ? Math.round(totals.movingS / 60) : null, fromTrack?.durationMin),
    elevationGain: pick(totals?.elevationGain != null ? Math.round(totals.elevationGain) : null, fromTrack?.elevationGain),
    avgHr: pick(totals?.avgHr, fromTrack?.avgHr),
    maxHr: pick(totals?.maxHr, fromTrack?.maxHr),
    maxSpeedKmh: pick(totals?.maxSpeedKmh != null ? round(totals.maxSpeedKmh, 1) : null, fromTrack?.maxSpeedKmh),
    startTime: pick(totals?.startTime, fromTrack?.startTime),
  };

  if (!stats.startTime) {
    throw new HttpError(400, 'El FIT no tiene la hora de inicio de la salida');
  }
  if (!stats.durationMin || stats.durationMin < 1) {
    throw new HttpError(400, 'El FIT no registra tiempo en movimiento');
  }

  return {
    stats,
    sportType: sportTypeOf(sport, subSport),
    track: segments.length ? buildTrack(segments, stats.startTime) : null,
    summaryPolyline: segments.length ? summaryPolyline(segments) : null,
  };
}

module.exports = { analyzeFit, recordsToSegments, sportTypeOf };
