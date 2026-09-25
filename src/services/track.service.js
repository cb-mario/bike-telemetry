const polyline = require('../utils/polyline');
const { round } = require('../utils/number');

// Cálculos y almacenamiento de tracks GPS, compartidos por la importación GPX y Strava

const EARTH_RADIUS_M = 6371008.8;
// Por debajo de esta velocidad un intervalo cuenta como parado (≈ 3,6 km/h)
const MIN_MOVING_SPEED_MS = 1;
// Suavizado de altitud: media móvil + umbral de histéresis contra el ruido del GPS
const ELEVATION_WINDOW = 5;
const ELEVATION_THRESHOLD_M = 2;
// Velocidad máxima: ventana mínima (s) para que un salto del GPS no la dispare, y tope físico
const MAX_SPEED_WINDOW_S = 10;
const MAX_PLAUSIBLE_SPEED_KMH = 120;
// Tamaño de lo que se guarda: puntos para el mapa y miniatura
const MAX_STORED_POINTS = 5000;
const MAX_PREVIEW_POINTS = 80;
const MAX_POLYLINE_POINTS = 300;

const toRad = (deg) => (deg * Math.PI) / 180;

// Mínimo y máximo con bucle: Math.min(...arr) desborda la pila con tracks muy largos
function extent(values) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

// Distancia en metros entre dos puntos (fórmula del haversine)
function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// --- Cálculos ---------------------------------------------------------------

// Desnivel positivo de un segmento: media móvil centrada + histéresis
function segmentElevationGain(points) {
  const raw = points.map((p) => p.ele).filter((e) => e != null);
  if (raw.length < 2) return 0;

  const half = Math.floor(ELEVATION_WINDOW / 2);
  const smooth = raw.map((_, i) => {
    const window = raw.slice(Math.max(0, i - half), i + half + 1);
    return window.reduce((sum, e) => sum + e, 0) / window.length;
  });

  let gain = 0;
  let reference = smooth[0];
  for (const e of smooth) {
    if (e - reference >= ELEVATION_THRESHOLD_M) {
      gain += e - reference;
      reference = e;
    } else if (e < reference) {
      reference = e;
    }
  }
  return gain;
}

// Velocidad máxima de un segmento, medida sobre ventanas de al menos MAX_SPEED_WINDOW_S
function segmentMaxSpeedKmh(points) {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + haversine(points[i - 1], points[i]));

  let best = 0;
  let start = 0;
  for (let end = 1; end < points.length; end++) {
    const tEnd = points[end].time;
    if (tEnd == null) continue;
    // Avanza el inicio mientras la ventana siga cumpliendo la duración mínima
    while (start + 1 < end && points[start + 1].time != null
      && (tEnd - points[start + 1].time) / 1000 >= MAX_SPEED_WINDOW_S) start++;
    const tStart = points[start].time;
    if (tStart == null) continue;
    const dt = (tEnd - tStart) / 1000;
    if (dt < MAX_SPEED_WINDOW_S) continue;
    const kmh = ((cumulative[end] - cumulative[start]) / dt) * 3.6;
    if (kmh > best && kmh <= MAX_PLAUSIBLE_SPEED_KMH) best = kmh;
  }
  return best;
}

function computeStats(segments) {
  let distanceM = 0;
  let movingS = 0;
  let elevationGain = 0;
  let hasElevation = false;
  let maxSpeedKmh = 0;
  const heartRates = [];

  for (const points of segments) {
    elevationGain += segmentElevationGain(points);
    maxSpeedKmh = Math.max(maxSpeedKmh, segmentMaxSpeedKmh(points));
    hasElevation ||= points.some((p) => p.ele != null);

    for (let i = 0; i < points.length; i++) {
      if (points[i].hr != null) heartRates.push(points[i].hr);
      if (i === 0) continue;

      const d = haversine(points[i - 1], points[i]);
      distanceM += d;

      // Tiempo en movimiento: solo intervalos con velocidad suficiente (descarta pausas)
      const { time: t0 } = points[i - 1];
      const { time: t1 } = points[i];
      if (t0 != null && t1 != null && t1 > t0) {
        const dt = (t1 - t0) / 1000;
        if (d / dt >= MIN_MOVING_SPEED_MS) movingS += dt;
      }
    }
  }

  const allTimes = segments.flat().map((p) => p.time).filter((t) => t != null);
  return {
    distanceKm: round(distanceM / 1000, 2),
    durationMin: Math.round(movingS / 60),
    elevationGain: hasElevation ? Math.round(elevationGain) : null,
    avgHr: heartRates.length ? Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length) : null,
    maxHr: heartRates.length ? extent(heartRates)[1] : null,
    maxSpeedKmh: maxSpeedKmh ? round(maxSpeedKmh, 1) : null,
    startTime: allTimes.length ? new Date(extent(allTimes)[0]) : null,
  };
}

// --- Almacenamiento del track -----------------------------------------------

// Reduce los segmentos a como mucho `max` puntos en total, repartidos por segmento
// y conservando siempre el primero y el último de cada uno
function downsample(segments, max) {
  const total = segments.reduce((sum, s) => sum + s.length, 0);
  if (total <= max) return segments;

  return segments.map((points) => {
    const keep = Math.max(2, Math.round((points.length / total) * max));
    if (points.length <= keep) return points;
    const step = (points.length - 1) / (keep - 1);
    return Array.from({ length: keep }, (_, i) => points[Math.round(i * step)]);
  });
}

function buildTrack(segments, startTime) {
  const all = segments.flat();
  const start = startTime?.getTime() ?? null;
  const [minLat, maxLat] = extent(all.map((p) => p.lat));
  const [minLon, maxLon] = extent(all.map((p) => p.lon));

  const stored = downsample(segments, MAX_STORED_POINTS).map((points) => points.map((p) => [
    round(p.lat, 6),
    round(p.lon, 6),
    p.ele != null ? round(p.ele, 1) : null,
    p.time != null && start != null ? Math.round((p.time - start) / 1000) : null,
    p.hr,
  ]));
  const preview = downsample(segments, MAX_PREVIEW_POINTS)
    .map((points) => points.map((p) => [round(p.lat, 5), round(p.lon, 5)]));

  return {
    points: JSON.stringify(stored),
    preview: JSON.stringify(preview),
    pointCount: stored.reduce((sum, s) => sum + s.length, 0),
    minLat,
    maxLat,
    minLon,
    maxLon,
  };
}


// Polilínea codificada (formato Strava) con como mucho MAX_POLYLINE_POINTS, para mapas y listados
function summaryPolyline(segments) {
  const coords = downsample(segments, MAX_POLYLINE_POINTS).flat().map((p) => [p.lat, p.lon]);
  return polyline.encode(coords);
}

// Coordenadas [[lat, lon]] reducidas a como mucho `max` puntos
function simplifyCoords(coords, max) {
  return downsample([coords.map(([lat, lon]) => ({ lat, lon }))], max)[0].map((p) => [round(p.lat, 5), round(p.lon, 5)]);
}

module.exports = {
  segmentElevationGain, haversine, extent, downsample, computeStats, buildTrack, summaryPolyline, simplifyCoords,
  MAX_PREVIEW_POINTS,
};
