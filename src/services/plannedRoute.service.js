const PlannedRoute = require('../models/plannedRoute.model');
const activityService = require('./activity.service');
const { HttpError } = require('../errors');
const { parseGpx } = require('./gpx.service');
const {
  haversine, segmentElevationGain, simplifyCoords, downsample, MAX_PREVIEW_POINTS,
} = require('./track.service');
const { round } = require('../utils/number');
const { MAX_WAYPOINTS } = require('../utils/plannedRouteValidation');

const MAX_IMPORTED_POINTS = 5000;
// Puntos de paso generados al importar: uno cada WAYPOINT_STEP_KM, para poder editar la ruta
const WAYPOINT_STEP_KM = 5;

// Distancia y desnivel calculados en el servidor a partir del trazado
function computeMetrics(geometry) {
  const points = geometry.map(([lat, lon, ele]) => ({ lat, lon, ele }));
  let meters = 0;
  for (let i = 1; i < points.length; i++) meters += haversine(points[i - 1], points[i]);
  const hasElevation = points.filter((p) => p.ele != null).length >= 2;
  return {
    distanceKm: round(meters / 1000, 2),
    elevationGain: hasElevation ? Math.round(segmentElevationGain(points)) : null,
  };
}

const previewOf = (geometry) => [simplifyCoords(geometry, MAX_PREVIEW_POINTS)];

// Listado: sin el trazado completo, con miniatura
function toSummary({ preview, ...route }) {
  return { ...route, preview: JSON.parse(preview) };
}

function toDetail({ preview, waypoints, geometry, ...route }) {
  const coords = JSON.parse(geometry);
  return {
    ...route,
    preview: preview ? JSON.parse(preview) : previewOf(coords),
    waypoints: JSON.parse(waypoints),
    geometry: coords,
  };
}

// Rutas guardadas antes de existir la columna preview: se calcula una vez y se guarda
async function fillMissingPreviews(routes) {
  const missing = routes.filter((r) => r.preview == null);
  if (!missing.length) return routes;
  const rows = await PlannedRoute.findGeometries(missing.map((r) => r.id));
  const previews = new Map(rows.map((r) => [r.id, JSON.stringify(previewOf(JSON.parse(r.geometry)))]));
  await Promise.all([...previews].map(([id, preview]) => PlannedRoute.setPreview(id, preview)));
  return routes.map((r) => (r.preview == null ? { ...r, preview: previews.get(r.id) } : r));
}

async function getOwnedOrFail(id, userId) {
  const route = await PlannedRoute.findByIdForUser(id, userId);
  if (!route) throw new HttpError(404, 'Ruta no encontrada');
  return route;
}

async function list(userId, { limit } = {}) {
  const routes = await fillMissingPreviews(await PlannedRoute.findManyByUser(userId, { limit }));
  return routes.map(toSummary);
}

async function getById(id, userId) {
  return toDetail(await getOwnedOrFail(id, userId));
}

function toData({ name, routing, waypoints, geometry }) {
  return {
    name,
    routing,
    waypoints: JSON.stringify(waypoints),
    geometry: JSON.stringify(geometry),
    preview: JSON.stringify(previewOf(geometry)),
    ...computeMetrics(geometry),
  };
}

async function create(userId, input) {
  return toDetail(await PlannedRoute.create(userId, toData(input)));
}

async function update(id, userId, input) {
  await getOwnedOrFail(id, userId);
  return toDetail(await PlannedRoute.update(id, toData(input)));
}

// --- Importación: GPX externo o salida ya hecha -------------------------------------

// Puntos de paso cada WAYPOINT_STEP_KM a lo largo del trazado (incluye inicio y final)
function waypointsFrom(geometry) {
  const totalKm = computeMetrics(geometry).distanceKm;
  const step = Math.max(WAYPOINT_STEP_KM, totalKm / (MAX_WAYPOINTS - 1));
  const waypoints = [[geometry[0][0], geometry[0][1]]];
  let km = 0;
  let nextMark = step;
  for (let i = 1; i < geometry.length; i++) {
    km += haversine({ lat: geometry[i - 1][0], lon: geometry[i - 1][1] }, { lat: geometry[i][0], lon: geometry[i][1] }) / 1000;
    if (km >= nextMark && i < geometry.length - 1) {
      waypoints.push([geometry[i][0], geometry[i][1]]);
      nextMark += step;
    }
  }
  const last = geometry.at(-1);
  waypoints.push([last[0], last[1]]);
  return waypoints;
}

// Segmentos de puntos → trazado único [[lat, lon, ele|null]] de como mucho MAX_IMPORTED_POINTS
function toGeometry(segments) {
  const points = downsample([segments.flat()], MAX_IMPORTED_POINTS)[0];
  return points.map((p) => [round(p.lat, 6), round(p.lon, 6), p.ele != null ? round(p.ele, 1) : null]);
}

function createFromGeometry(userId, name, geometry) {
  if (geometry.length < 2) throw new HttpError(400, 'El recorrido necesita al menos dos puntos');
  // Carretera por defecto: si se editan los puntos, los tramos se recalculan por vías ciclables
  return create(userId, { name: name.slice(0, 100), routing: 'road', waypoints: waypointsFrom(geometry), geometry });
}

// Cualquier GPX (con o sin marcas de tiempo) se convierte en ruta planificada
async function importGpx(userId, buffer, filename) {
  const { name, segments } = parseGpx(buffer);
  const fallbackName = filename?.replace(/\.gpx$/i, '').trim() || 'Ruta importada';
  return createFromGeometry(userId, name?.trim() || fallbackName, toGeometry(segments));
}

// "Repetir esta salida": su track completo o, si no hay, el trazado resumido
async function fromActivity(userId, activityId) {
  const activity = await activityService.getById(activityId, userId);
  let segments;
  try {
    const track = await activityService.getTrack(activityId, userId);
    segments = track.segments.map((seg) => seg.map(([lat, lon, ele]) => ({ lat, lon, ele })));
  } catch (err) {
    if (![404, 409].includes(err.status)) throw err;
    segments = (activity.routePreview ?? []).map((seg) => seg.map(([lat, lon]) => ({ lat, lon, ele: null })));
  }
  if (!segments.flat().length) throw new HttpError(400, 'Esta salida no tiene recorrido GPS');
  return createFromGeometry(userId, activity.title, toGeometry(segments));
}

async function remove(id, userId) {
  await getOwnedOrFail(id, userId);
  await PlannedRoute.remove(id);
}

// --- Exportación GPX ------------------------------------------------------------

const escapeXml = (text) => text.replace(/[<>&'"]/g, (c) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
}[c]));

// GPX 1.1 con el recorrido como track: el formato que importan Garmin, Wahoo, Hammerhead, etc.
function toGpx(route) {
  const geometry = JSON.parse(route.geometry);
  const name = escapeXml(route.name);
  const points = geometry.map(([lat, lon, ele]) => (
    `      <trkpt lat="${lat}" lon="${lon}">${ele != null ? `<ele>${ele}</ele>` : ''}</trkpt>`
  )).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BikeTelemetry" xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${name}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <type>cycling</type>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`;
}

// Nombre de archivo seguro: "Vuelta al Pantano!" → "vuelta-al-pantano.gpx"
function gpxFilename(name) {
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `${slug || 'ruta'}.gpx`;
}

async function exportGpx(id, userId) {
  const route = await getOwnedOrFail(id, userId);
  return { filename: gpxFilename(route.name), content: toGpx(route) };
}

module.exports = {
  list, getById, create, update, remove, exportGpx, importGpx, fromActivity, computeMetrics,
};
