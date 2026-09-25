const jwt = require('jsonwebtoken');

const User = require('../models/user.model');
const Activity = require('../models/activity.model');
const { HttpError } = require('../middlewares/errorHandler');
const { encrypt, decrypt } = require('../utils/crypto');
const { parseActivity, HR_MIN, HR_MAX } = require('../utils/activityValidation');
const { buildTrack } = require('./track.service');
const { loginRedirect } = require('../utils/loginTicket');

const STRAVA_OAUTH = 'https://www.strava.com/oauth';
const STRAVA_API = 'https://www.strava.com/api/v3';
const SCOPES = 'read,activity:read_all';
const STATE_PURPOSE = 'strava-oauth';
// Inicio de sesión con Strava (state sin usuario; la sesión se entrega con utils/loginTicket)
const LOGIN_STATE_PURPOSE = 'strava-login';
const SYNC_PAGE_SIZE = 30;
// Tipos de Strava que se importan (el campo "type"; el detalle va en "sport_type")
const RIDE_TYPES = ['Ride', 'VirtualRide'];
// Renovar el token si caduca en menos de este margen
const REFRESH_MARGIN_MS = 60 * 1000;

function config() {
  return {
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET,
    redirectUri: process.env.STRAVA_REDIRECT_URI || 'http://localhost:3000/api/strava/callback',
    frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  };
}

const isConfigured = () => Boolean(config().clientId && config().clientSecret);

function assertConfigured() {
  if (!isConfigured()) {
    throw new HttpError(503, 'La integración con Strava no está configurada (STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET)');
  }
}

// --- OAuth ------------------------------------------------------------------

const signState = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });

// URL de autorización. "state" es un JWT firmado y de vida corta que identifica al usuario:
// el callback llega desde el navegador sin cabecera Authorization y así además se evita CSRF
function buildAuthUrl(userId) {
  return authorizeUrl(signState({ sub: String(userId), purpose: STATE_PURPOSE }));
}

// URL para "Continuar con Strava" desde la pantalla de login (aún no hay usuario)
function buildLoginUrl() {
  return authorizeUrl(signState({ purpose: LOGIN_STATE_PURPOSE }));
}

function authorizeUrl(state) {
  assertConfigured();
  const { clientId, redirectUri } = config();
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
    res = await fetch(url, options);
  } catch {
    throw new HttpError(502, 'No se puede conectar con Strava');
  }
  const data = await res.json().catch(() => null);
  return { res, data };
}

async function requestToken(params) {
  const { clientId, clientSecret } = config();
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
  stravaAccessToken: encrypt(data.access_token),
  stravaRefreshToken: encrypt(data.refresh_token),
  stravaTokenExpiresAt: new Date(data.expires_at * 1000),
});

const readState = (state) => {
  try {
    return jwt.verify(state, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
};

const hasActivityScope = (scope) => {
  const granted = String(scope || '').split(',');
  return granted.includes('activity:read_all') || granted.includes('activity:read');
};

// Procesa la vuelta desde Strava y devuelve la URL del frontend a la que redirigir.
// El mismo callback sirve para conectar una cuenta existente y para iniciar sesión (según el state)
async function handleCallback({ code, scope, state, error }) {
  const payload = state ? readState(state) : null;
  if (payload?.purpose === LOGIN_STATE_PURPOSE) return handleLoginCallback({ code, scope, error });

  const back = (status) => `${config().frontendUrl}/salidas?strava=${status}`;
  if (error) return back('denied');
  if (!code || payload?.purpose !== STATE_PURPOSE) return back('error');
  const userId = Number(payload.sub);

  // Sin permiso de lectura de actividades la sincronización no puede funcionar
  if (!hasActivityScope(scope)) return back('scope');

  try {
    assertConfigured();
    const data = await requestToken({ code, grant_type: 'authorization_code' });
    const athleteId = String(data.athlete?.id ?? '');
    if (!athleteId) return back('error');

    const owner = await User.findByStravaAthleteId(athleteId);
    if (owner && owner.id !== userId) return back('taken');

    await User.updateStrava(userId, { stravaAthleteId: athleteId, ...tokenFields(data) });
    return back('connected');
  } catch {
    return back('error');
  }
}

// Datos de perfil que da Strava al autorizar (nunca el email)
function profileFromAthlete(athlete = {}) {
  const name = [athlete.firstname, athlete.lastname].filter(Boolean).join(' ').trim().slice(0, 60);
  const sex = { M: 'male', F: 'female' }[athlete.sex];
  return { ...(name && { name }), ...(sex && { sex }) };
}

// "Continuar con Strava": entra con la cuenta vinculada a ese atleta o crea una nueva
async function handleLoginCallback({ code, scope, error }) {
  const front = config().frontendUrl;
  const fail = (status) => `${front}/?strava_login=${status}`;
  if (error) return fail('denied');
  if (!code) return fail('error');
  if (!hasActivityScope(scope)) return fail('scope');

  try {
    assertConfigured();
    const data = await requestToken({ code, grant_type: 'authorization_code' });
    const athleteId = String(data.athlete?.id ?? '');
    if (!athleteId) return fail('error');

    const existing = await User.findByStravaAthleteId(athleteId);
    let userId = existing?.id;
    if (existing) {
      await User.updateStrava(userId, tokenFields(data));
    } else {
      ({ id: userId } = await User.createFromStrava({
        stravaAthleteId: athleteId, ...tokenFields(data), ...profileFromAthlete(data.athlete),
      }));
    }

    return loginRedirect(front, 'strava', userId, !existing);
  } catch {
    return fail('error');
  }
}

// --- Llamadas autenticadas ----------------------------------------------------

async function getConnectedUser(userId) {
  const user = await User.findStravaById(userId);
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  if (!user.stravaAthleteId || !user.stravaRefreshToken) {
    throw new HttpError(409, 'Conecta tu cuenta de Strava primero');
  }
  return user;
}

// Access token vigente, renovándolo con el refresh token si está a punto de caducar
async function getAccessToken(user) {
  if (user.stravaTokenExpiresAt && user.stravaTokenExpiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
    return decrypt(user.stravaAccessToken);
  }
  const data = await requestToken({ grant_type: 'refresh_token', refresh_token: decrypt(user.stravaRefreshToken) });
  await User.updateStrava(user.id, tokenFields(data));
  return data.access_token;
}

// Borra los tokens. Si Strava es la única forma de entrar se conserva el atleta vinculado,
// y volver a pulsar "Continuar con Strava" renueva los tokens
async function clearConnection(userId) {
  const keepIdentity = !(await User.canLoginWithoutStrava(userId));
  return User.updateStrava(userId, {
    ...(!keepIdentity && { stravaAthleteId: null }),
    stravaAccessToken: null, stravaRefreshToken: null, stravaTokenExpiresAt: null,
  });
}

async function stravaGet(user, path) {
  assertConfigured();
  const token = await getAccessToken(user);
  const { res, data } = await stravaRequest(`${STRAVA_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    // Acceso revocado desde Strava: se desvincula para que el usuario pueda reconectar
    await clearConnection(user.id);
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

// Actividad de Strava → datos validados de nuestra Activity (null si no es válida)
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
      stravaId: String(s.id),
      summaryPolyline: s.map?.summary_polyline || null,
    };
  } catch {
    return null; // p. ej. rodillo sin distancia o actividad de menos de 1 minuto
  }
}

async function sync(userId) {
  const user = await getConnectedUser(userId);
  const list = await stravaGet(user, `/athlete/activities?per_page=${SYNC_PAGE_SIZE}`);
  if (!Array.isArray(list)) throw new HttpError(502, 'Respuesta inesperada de Strava');

  const rides = list.filter((s) => RIDE_TYPES.includes(s.type));
  const existing = await Activity.findExistingStravaIds(rides.map((s) => String(s.id)));

  const created = [];
  let invalid = 0;
  for (const ride of rides.filter((s) => !existing.has(String(s.id)))) {
    const data = mapStravaActivity(ride);
    if (!data) {
      invalid += 1;
      continue;
    }
    try {
      created.push(await Activity.create(userId, data));
    } catch (err) {
      if (err.code !== 'P2002') throw err; // ya importada por una sincronización simultánea
    }
  }

  const lastSyncAt = new Date();
  await User.updateStrava(userId, { stravaLastSyncAt: lastSyncAt });

  return {
    imported: created.length,
    alreadyImported: existing.size,
    skippedNotRides: list.length - rides.length,
    skippedInvalid: invalid,
    lastSyncAt,
    activityIds: created.map((a) => a.id),
  };
}

// Descarga el track completo (streams) de una actividad de Strava y lo guarda
async function importStreams(userId, activity) {
  const user = await getConnectedUser(userId);
  const keys = 'latlng,altitude,time,heartrate';
  const streams = await stravaGet(user, `/activities/${activity.stravaId}/streams?keys=${keys}&key_by_type=true`);

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
  return Activity.createTrack(activity.id, buildTrack([points], activity.date));
}

async function status(userId) {
  const user = await User.findStravaById(userId);
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  return {
    configured: isConfigured(),
    connected: Boolean(user.stravaAthleteId && user.stravaRefreshToken),
    athleteId: user.stravaAthleteId,
    lastSyncAt: user.stravaLastSyncAt,
    // Sin contraseña ni Google, Strava es la única forma de entrar
    canDisconnect: await User.canLoginWithoutStrava(userId),
  };
}

// Revoca el acceso en Strava (si se puede) y borra los tokens; las actividades se conservan
async function disconnect(userId) {
  if (!(await User.canLoginWithoutStrava(userId))) {
    throw new HttpError(409, 'Tu cuenta entra con Strava: si lo desconectas no podrás volver a iniciar sesión');
  }
  const user = await User.findStravaById(userId);
  if (user?.stravaAccessToken && isConfigured()) {
    try {
      const token = await getAccessToken(user);
      await fetch(`${STRAVA_OAUTH}/deauthorize`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // Aunque Strava no responda, se desvincula localmente
    }
  }
  await clearConnection(userId);
}

module.exports = {
  buildAuthUrl, buildLoginUrl, handleCallback, sync, importStreams, status, disconnect, mapStravaActivity,
};
