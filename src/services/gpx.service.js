const { DOMParser } = require('@xmldom/xmldom');
const { gpx: gpxToGeoJson } = require('@tmcw/togeojson');

const { HttpError } = require('../middlewares/errorHandler');
const { computeStats, buildTrack, summaryPolyline, haversine } = require('./track.service');

// Lecturas de pulso fuera de este rango se consideran artefactos del sensor
const HR_VALID_MIN = 40;
const HR_VALID_MAX = 220;

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

  return {
    name,
    stats,
    track: buildTrack(segments, stats.startTime),
    summaryPolyline: summaryPolyline(segments),
  };
}

module.exports = { analyzeGpx, parseGpx, computeStats, haversine };
