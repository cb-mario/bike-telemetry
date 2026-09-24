const { DOMParser } = require('@xmldom/xmldom');
const { gpx: gpxToGeoJson } = require('@tmcw/togeojson');

const { HttpError } = require('../middlewares/errorHandler');

const EARTH_RADIUS_M = 6371008.8;
// Por debajo de esta velocidad un intervalo cuenta como parado (≈ 3,6 km/h)
const MIN_MOVING_SPEED_MS = 1;
// Suavizado de altitud: media móvil + umbral de histéresis contra el ruido del GPS
const ELEVATION_WINDOW = 5;
const ELEVATION_THRESHOLD_M = 2;
// Lecturas de pulso fuera de este rango se consideran artefactos del sensor
const HR_VALID_MIN = 40;
const HR_VALID_MAX = 220;
// Tamaño de lo que se guarda: puntos para el mapa y miniatura
const MAX_STORED_POINTS = 5000;
const MAX_PREVIEW_POINTS = 80;

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
const round = (value, decimals) => Math.round(value * 10 ** decimals) / 10 ** decimals;

// Distancia en metros entre dos puntos (fórmula del haversine)
function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// --- Parseo -----------------------------------------------------------------

// Convierte el XML en { name, segments: [[{ lat, lon, ele, time, hr }]] }
function parseGpx(buffer) {
  const xml = buffer.toString('utf8');

  // Un GPX nunca necesita DTD: se rechaza para evitar ataques de expansión de entidades
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new HttpError(400, 'El archivo GPX contiene declaraciones no permitidas');
  }

  let doc;
  try {
    doc = new DOMParser({ onError: (level, msg) => { if (level !== 'warning') throw new Error(msg); } })
      .parseFromString(xml, 'text/xml');
  } catch {
    throw new HttpError(400, 'El archivo no es un GPX válido');
  }
  if (doc?.documentElement?.localName !== 'gpx') {
    throw new HttpError(400, 'El archivo no es un GPX válido');
  }

  const features = gpxToGeoJson(doc).features;
  // Se usan los tracks grabados; si no hay, las rutas (<rte>)
  const tracks = features.filter((f) => f.properties._gpxType === 'trk');
  const selected = tracks.length ? tracks : features.filter((f) => f.properties._gpxType === 'rte');

  const segments = [];
  for (const feature of selected) {
    const { geometry, properties } = feature;
    const multi = geometry.type === 'MultiLineString';
    const lines = multi ? geometry.coordinates : [geometry.coordinates];
    const times = properties.coordinateProperties?.times;
    const hearts = properties.coordinateProperties?.heart;

    lines.forEach((line, s) => {
      const segTimes = multi ? times?.[s] : times;
      const segHearts = multi ? hearts?.[s] : hearts;
      const points = line.map(([lon, lat, ele], i) => {
        const time = segTimes?.[i] ? Date.parse(segTimes[i]) : NaN;
        const hr = segHearts?.[i];
        return {
          lat,
          lon,
          ele: Number.isFinite(ele) ? ele : null,
          time: Number.isFinite(time) ? time : null,
          hr: Number.isFinite(hr) && hr >= HR_VALID_MIN && hr <= HR_VALID_MAX ? hr : null,
        };
      });
      if (points.length >= 2) segments.push(points);
    });
  }

  if (!segments.length) {
    throw new HttpError(400, 'El GPX no contiene ningún track con al menos dos puntos');
  }

  const name = selected.find((f) => f.properties.name)?.properties.name ?? null;
  return { name, segments };
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

function computeStats(segments) {
  let distanceM = 0;
  let movingS = 0;
  let elevationGain = 0;
  let hasElevation = false;
  const heartRates = [];

  for (const points of segments) {
    elevationGain += segmentElevationGain(points);
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

// Analiza un GPX: devuelve el nombre, las métricas calculadas y el track a guardar
function analyzeGpx(buffer) {
  const { name, segments } = parseGpx(buffer);
  const stats = computeStats(segments);

  if (!stats.startTime) {
    throw new HttpError(400, 'El GPX no tiene marcas de tiempo: no se puede calcular la duración');
  }
  if (stats.durationMin < 1) {
    throw new HttpError(400, 'El GPX no registra tiempo en movimiento');
  }

  return { name, stats, track: buildTrack(segments, stats.startTime) };
}

module.exports = { analyzeGpx, parseGpx, computeStats, haversine };
