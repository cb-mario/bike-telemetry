const Connection = require('../../models/connection.model');
const config = require('../../config');
const Activity = require('../../models/activity.model');
const { HttpError } = require('../../errors');
const { encrypt, decrypt } = require('../../utils/crypto');
const { parseActivity, HR_MIN, HR_MAX } = require('../../utils/activityValidation');
const { buildTrack } = require('../track.service');
const { saveExternalRide } = require('../import.service');
const { signPurpose, readPurpose } = require('../../utils/signedToken');

const STRAVA_OAUTH = 'https://www.strava.com/oauth';
const STRAVA_API = 'https://www.strava.com/api/v3';
const SCOPES = 'read,activity:read_all';
const PROVIDER = 'strava';
const STATE_PURPOSE = 'strava-oauth';
// Sincronización por páginas; como mucho SYNC_MAX_PAGES por vez (límite de Strava: 100 peticiones
// cada 15 min). Si queda historial por traer, la respuesta lo indica con hasMore
const SYNC_PAGE_SIZE = 100;
const SYNC_MAX_PAGES = 10;
// Tipos de Strava que se importan (el campo "type"; el detalle va en "sport_type")
const RIDE_TYPES = ['Ride', 'VirtualRide'];
// Renovar el token si caduca en menos de este margen
const REFRESH_MARGIN_MS = 60 * 1000;
// Una petición a Strava que tarde más se da por fallida (no deja la petición del usuario colgada)
const TIMEOUT_MS = 15000;

const STATE_TTL = '10m';

// Apagado salvo STRAVA_ENABLED=true, aunque estén las credenciales
const isConfigured = () => {
  const { enabled, clientId, clientSecret } = config.strava();
  return Boolean(enabled && clientId && clientSecret);
};

function assertConfigured() {
  if (!isConfigured()) {
    throw new HttpError(503, 'La integración con Strava no está activada (STRAVA_ENABLED / STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET)');
  }
}

// --- OAuth ------------------------------------------------------------------

// URL de autorización. "state" es un JWT firmado y de vida corta que identifica al usuario:
// el callback llega desde el navegador sin cabecera Authorization y así además se evita CSRF
function buildAuthUrl(userId) {
  assertConfigured();
  const state = signPurpose(STATE_PURPOSE, { sub: String(userId) }, STATE_TTL);
  const { clientId, redirectUri } = config.strava();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPES,
    state,
  });
  return `${STRAVA_OAUTH}/authorize?${params}`;
}

async function stravaRequest(url, options) {
  let res;
  try {
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new HttpError(502, 'No se puede conectar con Strava');
  }
  const data = await res.json().catch(() => null);
  return { res, data };
}

async function requestToken(params) {
  const { clientId, clientSecret } = config.strava();
  const { res, data } = await stravaRequest(`${STRAVA_OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...params }),
  });
  if (!res.ok || !data?.access_token) {
    throw new HttpError(502, 'Strava rechazó la solicitud de token');
  }
  return data;
}

const tokenFields = (data) => ({
  accessToken: encrypt(data.access_token),
  refreshToken: encrypt(data.refresh_token),
  tokenExpiresAt: new Date(data.expires_at * 1000),
});

const hasActivityScope = (scope) => {
  const granted = String(scope || '').split(',');
  return granted.includes('activity:read_all') || granted.includes('activity:read');
};

// Procesa la vuelta desde Strava y devuelve la URL del frontend a la que redirigir.
// Strava es solo una fuente de salidas: siempre se conecta a una cuenta con sesión (la del state)
async function handleCallback({ code, scope, state, error }) {
  const payload = readPurpose(state, [STATE_PURPOSE]);
  const back = (status) => `${config.frontendUrl()}/perfil?strava=${status}`;
  if (error) return back('denied');
  if (!code || !payload) return back('error');
  const userId = Number(payload.sub);

  // Sin permiso de lectura de actividades la sincronización no puede funcionar
  if (!hasActivityScope(scope)) return back('scope');

  try {
    assertConfigured();
    const data = await requestToken({ code, grant_type: 'authorization_code' });
    const athleteId = String(data.athlete?.id ?? '');
    if (!athleteId) return back('error');

    const owner = await Connection.findByAccount(PROVIDER, athleteId);
    if (owner && owner.userId !== userId) return back('taken');

    await Connection.save(userId, PROVIDER, { account: athleteId, ...tokenFields(data) });
    return back('connected');
  } catch {
    return back('error');
  }
}

// --- Llamadas autenticadas ----------------------------------------------------

async function getConnection(userId) {
  const conn = await Connection.find(userId, PROVIDER);
  if (!conn?.refreshToken) throw new HttpError(409, 'Conecta tu cuenta de Strava primero');
  return conn;
}

// Access token vigente, renovándolo con el refresh token si está a punto de caducar
async function getAccessToken(conn) {
  if (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
    return decrypt(conn.accessToken);
  }
  const data = await requestToken({ grant_type: 'refresh_token', refresh_token: decrypt(conn.refreshToken) });
  await Connection.update(conn.userId, PROVIDER, tokenFields(data));
  return data.access_token;
}

async function stravaGet(conn, path) {
  assertConfigured();
  const token = await getAccessToken(conn);
  const { res, data } = await stravaRequest(`${STRAVA_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    // Acceso revocado desde Strava: se desvincula para que el usuario pueda reconectar
    await Connection.remove(conn.userId, PROVIDER);
    throw new HttpError(409, 'Strava ha revocado el acceso. Vuelve a conectar tu cuenta');
  }
  if (res.status === 429) throw new HttpError(429, 'Límite de peticiones de Strava alcanzado. Inténtalo en unos minutos');
  if (res.status === 404) throw new HttpError(404, 'Recurso no encontrado en Strava');
  if (!res.ok) throw new HttpError(502, 'Strava devolvió un error inesperado');
  return data;
}

// --- Sincronización -------------------------------------------------------------

const sanitizeHr = (value) => {
  const hr = Math.round(value);
  return Number.isFinite(hr) && hr >= HR_MIN && hr <= HR_MAX ? hr : null;
};

// Actividad de Strava → datos validados de nuestra Activity (null si no es válida).
// Su id en Strava se guarda aparte, en ActivityImport
function mapStravaActivity(s) {
  const avgHr = s.has_heartrate ? sanitizeHr(s.average_heartrate) : null;
  const maxHr = s.has_heartrate ? sanitizeHr(s.max_heartrate) : null;
  const maxSpeedKmh = Number.isFinite(s.max_speed) && s.max_speed > 0
    ? Math.min(Math.round(s.max_speed * 36) / 10, 150)
    : null;

  try {
    const data = parseActivity({
      title: String(s.name || 'Salida en Strava').trim().slice(0, 100) || 'Salida en Strava',
      date: s.start_date,
      distanceKm: Math.round(s.distance / 10) / 100,
      durationMin: Math.round(s.moving_time / 60),
      elevationGain: Number.isFinite(s.total_elevation_gain) ? Math.round(s.total_elevation_gain) : null,
      // El redondeo puede dejar la media por encima de la máxima
      avgHr: avgHr != null && maxHr != null ? Math.min(avgHr, maxHr) : avgHr,
      maxHr,
      maxSpeedKmh,
    }, { partial: false });

    return {
      ...data,
      sportType: s.sport_type || s.type,
      source: 'strava',
      summaryPolyline: s.map?.summary_polyline || null,
    };
  } catch {
    return null; // p. ej. rodillo sin distancia o actividad de menos de 1 minuto
  }
}

async function fetchActivityPage(conn, { page, before }) {
  const params = new URLSearchParams({ per_page: SYNC_PAGE_SIZE, page, ...(before && { before }) });
  const list = await stravaGet(conn, `/athlete/activities?${params}`);
  if (!Array.isArray(list)) throw new HttpError(502, 'Respuesta inesperada de Strava');
  return list;
}

// Recorre las páginas (de la más reciente a la más antigua) mientras `keepGoing(lista)` lo pida
// y no se acabe el presupuesto de páginas. Devuelve si ha llegado al final del historial
async function walkPages(conn, { before, budget, onPage }) {
  for (let page = 1; budget.left > 0; page++) {
    budget.left -= 1;
    const list = await fetchActivityPage(conn, { page, before });
    const keepGoing = await onPage(list);
    if (list.length < SYNC_PAGE_SIZE) return true;
    if (!keepGoing) return false;
  }
  return false;
}

async function sync(userId) {
  const conn = await getConnection(userId);
  const budget = { left: SYNC_MAX_PAGES };
  const seen = new Map(); // id → actividad de Strava (sin repetir entre páginas)
  let notRides = 0;

  const collect = async (list) => {
    const fresh = list.filter((s) => !seen.has(String(s.id)));
    fresh.forEach((s) => seen.set(String(s.id), s));
    notRides += fresh.filter((s) => !RIDE_TYPES.includes(s.type)).length;
    const rideIds = fresh.filter((s) => RIDE_TYPES.includes(s.type)).map((s) => String(s.id));
    const existing = await Activity.findImportedIds(PROVIDER, rideIds);
    return { rideIds, existing };
  };

  // 1) Lo nuevo: desde la más reciente hasta una página cuyas salidas ya estén todas importadas
  const reachedEnd = await walkPages(conn, {
    budget,
    onPage: async (list) => {
      const { rideIds, existing } = await collect(list);
      return !(rideIds.length && rideIds.every((id) => existing.has(id)));
    },
  });

  // 2) Lo antiguo que falte (primera sincronización larga): antes de la salida más antigua importada
  let complete = reachedEnd;
  if (!reachedEnd && budget.left > 0) {
    const oldest = await Activity.oldestImportDate(userId, PROVIDER);
    const before = oldest && Math.floor(oldest.getTime() / 1000);
    complete = await walkPages(conn, { before, budget, onPage: async (list) => (await collect(list), true) });
  }

  const rides = [...seen.values()].filter((s) => RIDE_TYPES.includes(s.type));
  const existing = await Activity.findImportedIds(PROVIDER, rides.map((s) => String(s.id)));

  const created = [];
  let invalid = 0;
  let duplicates = 0;
  for (const ride of rides.filter((s) => !existing.has(String(s.id)))) {
    const data = mapStravaActivity(ride);
    if (!data) {
      invalid += 1;
      continue;
    }
    const saved = await saveExternalRide(userId, { provider: PROVIDER, externalId: String(ride.id) }, data);
    if (saved?.created) created.push(saved.activity);
    else if (saved) duplicates += 1;
  }

  const lastSyncAt = new Date();
  await Connection.update(userId, PROVIDER, { lastSyncAt });

  return {
    imported: created.length,
    alreadyImported: existing.size,
    // Ya estaban en la app por otra vía (un .gpx, otro servicio): no se duplican
    duplicates,
    skippedNotRides: notRides,
    skippedInvalid: invalid,
    // Queda historial por traer: otra sincronización seguirá donde lo ha dejado esta
    hasMore: !complete,
    lastSyncAt,
    activityIds: created.map((a) => a.id),
  };
}

// Descarga el track completo (streams) de una actividad de Strava y lo guarda
async function importStreams(userId, activity, stravaId) {
  const conn = await getConnection(userId);
  const keys = 'latlng,altitude,time,heartrate';
  const streams = await stravaGet(conn, `/activities/${stravaId}/streams?keys=${keys}&key_by_type=true`);

  const latlng = streams?.latlng?.data;
  if (!Array.isArray(latlng) || latlng.length < 2) return null;

  const start = activity.date.getTime();
  const points = latlng.map(([lat, lon], i) => ({
    lat,
    lon,
    ele: streams.altitude?.data?.[i] ?? null,
    time: streams.time?.data?.[i] != null ? start + streams.time.data[i] * 1000 : null,
    hr: streams.heartrate?.data?.[i] != null ? sanitizeHr(streams.heartrate.data[i]) : null,
  }));
  try {
    return await Activity.createTrack(activity.id, buildTrack([points], activity.date));
  } catch (err) {
    // Otra petición simultánea ya lo ha guardado
    if (err.code === 'P2002') return Activity.findTrack(activity.id);
    throw err;
  }
}

// Revoca el acceso en Strava (si se puede) y borra la conexión; las actividades se conservan
async function disconnect(userId) {
  const conn = await Connection.find(userId, PROVIDER);
  if (conn?.accessToken && isConfigured()) {
    try {
      const token = await getAccessToken(conn);
      await fetch(`${STRAVA_OAUTH}/deauthorize`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      // Aunque Strava no responda, se desvincula localmente
    }
  }
  await Connection.remove(userId, PROVIDER);
}

// Fuente de salidas (forma común en sources/index.js). Se conecta por OAuth: `connect` devuelve
// la URL de Strava y la vuelta llega a handleCallback
module.exports = {
  id: PROVIDER,
  name: 'Strava',
  auth: 'oauth',
  isConfigured,
  connect: (userId) => ({ url: buildAuthUrl(userId) }),
  sync,
  disconnect,
  handleCallback,
  importStreams,
  mapStravaActivity,
};
