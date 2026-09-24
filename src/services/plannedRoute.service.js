const PlannedRoute = require('../models/plannedRoute.model');
const { HttpError } = require('../middlewares/errorHandler');
const { haversine, segmentElevationGain, simplifyCoords, round } = require('./track.service');

const PREVIEW_POINTS = 80;

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

// Listado: sin el trazado completo, con miniatura
function toSummary({ geometry, ...route }) {
  const coords = JSON.parse(geometry);
  return { ...route, preview: [simplifyCoords(coords, PREVIEW_POINTS)] };
}

function toDetail(route) {
  return {
    ...toSummary(route),
    waypoints: JSON.parse(route.waypoints),
    geometry: JSON.parse(route.geometry),
  };
}

async function getOwnedOrFail(id, userId) {
  const route = await PlannedRoute.findByIdForUser(id, userId);
  if (!route) throw new HttpError(404, 'Ruta no encontrada');
  return route;
}

async function list(userId) {
  return (await PlannedRoute.findManyByUser(userId)).map(toSummary);
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

module.exports = { list, getById, create, update, remove, exportGpx, computeMetrics };
