const Connection = require('../../models/connection.model');
const Activity = require('../../models/activity.model');
const config = require('../../config');
const { HttpError } = require('../../errors');
const { encrypt, decrypt } = require('../../utils/crypto');
const { analyzeFile } = require('../activity.service');
const { saveExternalRide } = require('../import.service');

// Conexión con iGPSPORT a través de la API de su web (no es una API pública ni documentada:
// es la que usan su web y varios proyectos libres de sincronización). Descarga los .fit
// originales y los importa con el mismo análisis que un archivo subido a mano.

// Una petición a iGPSPORT que tarde más se da por fallida
const PROVIDER = 'igpsport';
const TIMEOUT_MS = 15000;
// Cada sincronización trabaja como mucho este tiempo (Vercel corta la función a los 60 s);
// si queda historial por traer, la respuesta lo indica con hasMore
const SYNC_BUDGET_MS = 40000;
const PAGE_SIZE = 20;
const MAX_PAGES = 100;
const CONCURRENCY = 3;
// Sin caducidad legible en el token se da por buena una semana
const DEFAULT_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const CONNECTION_LOST = 'La sesión con iGPSPORT ha caducado. Vuelve a conectar tu cuenta';

// Guarda cifrado el token solo si hay clave de cifrado (la misma que los tokens de Strava)
const isConfigured = () => /^[0-9a-f]{64}$/i.test(process.env.TOKEN_ENCRYPTION_KEY || '');

// El token ya no vale (HTTP o código 401/403): hay que volver a conectar
class SessionExpired extends Error {}
// iGPSPORT ha respondido, pero con un error ({ code, message } o HTTP 4xx/5xx)
class IgpRejected extends HttpError {
  constructor(message) {
    super(502, `iGPSPORT: ${message}`);
    this.igpMessage = message;
  }
}

const isAuthCode = (code) => code === 401 || code === 403;

async function igpRequest(path, { method = 'GET', token, body, query } = {}) {
  const url = new URL(`${config.igpsportApiUrl()}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, String(v));
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        accept: 'application/json',
        ...(body && { 'content-type': 'application/json' }),
        ...(token && { authorization: `Bearer ${token}` }),
      },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(502, 'No se puede conectar con iGPSPORT. Inténtalo más tarde');
  }
  if (isAuthCode(res.status)) throw new SessionExpired();
  const payload = await res.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    throw new HttpError(502, `iGPSPORT no responde como se esperaba (HTTP ${res.status})`);
  }
  // Respuestas { code, message, data }: code 0 es éxito
  if (isAuthCode(payload.code)) throw new SessionExpired();
  if (!res.ok || (payload.code !== undefined && payload.code !== 0)) {
    throw new IgpRejected(payload.message || `HTTP ${res.status}`);
  }
  return payload;
}

// Caducidad del token si es un JWT con "exp"; si no, una semana
function tokenExpiry(token) {
  try {
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    if (Number.isFinite(exp)) return new Date(exp * 1000);
  } catch {
    // Token opaco
  }
  return new Date(Date.now() + DEFAULT_TOKEN_TTL_MS);
}

// --- Conexión ---------------------------------------------------------------

// Inicia sesión en iGPSPORT con el email y la contraseña del usuario. La contraseña se usa
// solo para esta petición: se guarda el token de sesión cifrado, nunca la contraseña
async function connect(userId, { email, password } = {}) {
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    throw new HttpError(400, 'Indica el email y la contraseña de tu cuenta de iGPSPORT');
  }

  let payload;
  try {
    payload = await igpRequest('/auth/account/login', {
      method: 'POST',
      body: { appId: 'igpsport-web', username: email.trim(), password },
    });
  } catch (err) {
    // Credenciales rechazadas; los fallos de red (502 sin respuesta) se propagan tal cual
    if (err instanceof SessionExpired || err instanceof IgpRejected) payload = null;
    else throw err;
  }
  const token = payload?.data?.access_token;
  if (!token) throw new HttpError(400, 'iGPSPORT no ha aceptado ese email y contraseña');

  const account = email.trim().toLowerCase().slice(0, 254);
  const owner = await Connection.findByAccount(PROVIDER, account);
  if (owner && owner.userId !== userId) throw new HttpError(409, 'Esa cuenta de iGPSPORT ya está conectada a otro usuario');

  const conn = await Connection.save(userId, PROVIDER, {
    account,
    accessToken: encrypt(token),
    tokenExpiresAt: tokenExpiry(token),
  });
  return { account: conn.account, lastSyncAt: conn.lastSyncAt };
}

// No hay forma de cerrar la sesión en iGPSPORT: basta con olvidar el token
async function disconnect(userId) {
  await Connection.remove(userId, PROVIDER);
}

// Token vigente; si ha caducado se borra la conexión y hay que volver a conectar (409, como Strava)
async function getToken(userId) {
  const conn = await Connection.find(userId, PROVIDER);
  if (!conn?.accessToken) throw new HttpError(409, 'Conecta tu cuenta de iGPSPORT primero');
  if (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() <= Date.now()) {
    await disconnect(userId);
    throw new HttpError(409, CONNECTION_LOST);
  }
  return decrypt(conn.accessToken);
}
// --- Sincronización ---------------------------------------------------------

const dataOf = (payload) => payload.data;

// Todas las salidas de la cuenta, de la más reciente a la más antigua: [{ rideId, title }]
async function listRides(token) {
  const rides = [];
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
    const data = dataOf(await igpRequest('/web-gateway/web-analyze/activity/queryMyActivity', {
      token, query: { pageNo, pageSize: PAGE_SIZE, sort: 1, reqType: 0 },
    }));
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    for (const row of rows) {
      const rideId = row?.rideId ?? row?.RideId;
      if (rideId != null) rides.push({ rideId: String(rideId), title: row.title ?? row.Title ?? null });
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return rides;
}

// Dirección de descarga del .fit: la da el detalle de la salida o, si no, getDownloadUrl
async function fitUrlOf(token, rideId) {
  const base = '/web-gateway/web-analyze/activity';
  try {
    const detail = dataOf(await igpRequest(`${base}/queryActivityDetail/${encodeURIComponent(rideId)}`, { token }));
    if (detail?.fitUrl) return detail.fitUrl;
  } catch (err) {
    if (!(err instanceof IgpRejected)) throw err;
  }
  const fallback = dataOf(await igpRequest(`${base}/getDownloadUrl/${encodeURIComponent(rideId)}`, { token }));
  return typeof fallback === 'string' ? fallback : null;
}

async function downloadFit(url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new HttpError(502, 'No se pudo descargar el archivo de iGPSPORT');
  }
  if (!res.ok) throw new HttpError(502, `No se pudo descargar el archivo de iGPSPORT (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// Títulos genéricos que pone iGPSPORT: mejor el de la app ("Salida del ...")
const GENERIC_TITLE = /^(cycling|ride|riding|outdoor cycling|骑行|户外骑行)$/i;
const titleOf = (ride) => (ride.title && !GENERIC_TITLE.test(ride.title.trim()) ? ride.title : undefined);

// Descarga el .fit de una salida y la guarda (o la enlaza, si ya estaba por otra vía).
// Devuelve 'imported' o 'duplicates'
async function importRide(userId, fit, ride) {
  const { data, track } = await analyzeFile(fit, { format: 'fit', title: titleOf(ride) });
  const saved = await saveExternalRide(userId, { provider: PROVIDER, externalId: ride.rideId }, { ...data, source: PROVIDER }, track);
  return saved?.created ? 'imported' : 'duplicates';
}

// Importa las salidas de iGPSPORT que aún no estén en la app, empezando por las más recientes.
// Trabaja como mucho SYNC_BUDGET_MS; si queda historial, lo indica con hasMore
async function sync(userId) {
  const token = await getToken(userId);
  const deadline = Date.now() + SYNC_BUDGET_MS;
  const result = { imported: 0, duplicates: 0, alreadyImported: 0, skipped: 0, errors: [] };

  try {
    const rides = await listRides(token);
    const known = await Activity.findImportedIds(PROVIDER, rides.map((r) => r.rideId));
    const pending = rides.filter((r) => !known.has(r.rideId));
    result.alreadyImported = known.size;

    // Las descargas van en paralelo; comprobar si ya existe y guardar, de una en una
    // (dos copias de la misma salida no deben crearse a la vez)
    let queue = Promise.resolve();
    const oneAtATime = (fn) => {
      const run = queue.then(fn);
      queue = run.catch(() => {});
      return run;
    };

    let next = 0;
    const worker = async () => {
      while (next < pending.length && Date.now() < deadline) {
        const ride = pending[next++];
        try {
          const url = await fitUrlOf(token, ride.rideId);
          if (!url) throw new HttpError(502, 'iGPSPORT no da el archivo de esta salida');
          const fit = await downloadFit(url);
          const outcome = await oneAtATime(() => importRide(userId, fit, ride));
          result[outcome] += 1;
        } catch (err) {
          if (err instanceof SessionExpired) throw err;
          // Una salida que no se puede importar (no es de bici, archivo dañado...) no para el resto
          if (!(err instanceof HttpError)) throw err;
          result.skipped += 1;
          if (result.errors.length < 5) result.errors.push({ rideId: ride.rideId, error: err.message });
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    result.hasMore = next < pending.length;
  } catch (err) {
    if (err instanceof SessionExpired) {
      await disconnect(userId);
      throw new HttpError(409, CONNECTION_LOST);
    }
    throw err;
  }

  const lastSyncAt = new Date();
  await Connection.update(userId, PROVIDER, { lastSyncAt });
  return { ...result, lastSyncAt };
}

// Fuente de salidas (forma común en sources/index.js). Se conecta con email y contraseña
module.exports = {
  id: PROVIDER,
  name: 'iGPSPORT',
  auth: 'credentials',
  isConfigured,
  connect,
  sync,
  disconnect,
};
