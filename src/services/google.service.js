const jwt = require('jsonwebtoken');

const User = require('../models/user.model');
const config = require('../config');
const { HttpError } = require('../errors');
const { loginRedirect } = require('../utils/loginTicket');
const { signPurpose, readPurpose } = require('../utils/signedToken');

// "Continuar con Google" (OAuth 2.0 / OpenID Connect, flujo de código en el servidor)
const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const SCOPES = 'openid email profile';
const LOGIN_PURPOSE = 'google-login';
const LINK_PURPOSE = 'google-link';
const TIMEOUT_MS = 15000;
const STATE_TTL = '10m';

const isConfigured = () => {
  const { clientId, clientSecret } = config.google();
  return Boolean(clientId && clientSecret);
};

function assertConfigured() {
  if (!isConfigured()) {
    throw new HttpError(503, 'El acceso con Google no está configurado (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)');
  }
}

// --- URLs de autorización --------------------------------------------------------

// "state" es un JWT firmado y de vida corta: evita CSRF y, al vincular, identifica al usuario
function authorizeUrl(purpose, payload = {}) {
  assertConfigured();
  const { clientId, redirectUri } = config.google();
  const state = signPurpose(purpose, payload, STATE_TTL);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    prompt: 'select_account',
    state,
  });
  return `${GOOGLE_AUTH}?${params}`;
}

const buildLoginUrl = () => authorizeUrl(LOGIN_PURPOSE);
const buildLinkUrl = (userId) => authorizeUrl(LINK_PURPOSE, { sub: String(userId) });

// --- Callback ------------------------------------------------------------------------

// Canjea el código por tokens y devuelve la identidad del ID token. El ID token llega directamente
// de Google por TLS en respuesta a nuestra petición autenticada con el client secret, así que basta
// con comprobar sus claims (OpenID Connect Core, 3.1.3.7)
async function fetchIdentity(code) {
  const { clientId, clientSecret, redirectUri } = config.google();
  let res;
  try {
    res = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  const data = await res.json().catch(() => null);
  const claims = res.ok && data?.id_token ? jwt.decode(data.id_token) : null;
  if (!claims?.sub) return null;
  if (!GOOGLE_ISSUERS.includes(claims.iss) || claims.aud !== clientId) return null;
  if (!claims.exp || claims.exp * 1000 < Date.now()) return null;
  return {
    googleId: String(claims.sub),
    email: claims.email_verified === true && typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : null,
    name: typeof claims.name === 'string' ? claims.name.trim().slice(0, 60) || null : null,
  };
}

// Procesa la vuelta desde Google y devuelve la URL del frontend a la que redirigir
async function handleCallback({ code, state, error }) {
  const frontendUrl = config.frontendUrl();
  const payload = readPurpose(state, [LOGIN_PURPOSE, LINK_PURPOSE]);
  const linking = payload?.purpose === LINK_PURPOSE;
  const back = linking
    ? (status) => `${frontendUrl}/perfil?google=${status}`
    : (status) => `${frontendUrl}/entrar?google_login=${status}`;

  if (error) return back('denied');
  if (!code || !payload) return back('error');

  try {
    assertConfigured();
    const identity = await fetchIdentity(code);
    if (!identity) return back('error');

    const owner = await User.findByGoogleId(identity.googleId);

    // Vincular Google a la cuenta con la que ya se ha iniciado sesión
    if (linking) {
      const userId = Number(payload.sub);
      if (owner && owner.id !== userId) return back('taken');
      await User.setGoogleId(userId, identity.googleId);
      return back('linked');
    }

    // Iniciar sesión: cuenta ya vinculada a esta cuenta de Google
    if (owner) return loginRedirect(frontendUrl, 'google', owner.id, false);

    // Cuenta nueva: hace falta un email verificado por Google
    if (!identity.email) return back('unverified');
    // Ya hay una cuenta con ese email: no se vincula sola. Como el registro no verifica el email,
    // unirlas permitiría a quien registró ese email (sin ser suyo) entrar en la cuenta de Google de otra
    // persona. Se vincula desde el perfil tras entrar con la contraseña
    if (await User.findByEmail(identity.email)) return back('exists');

    const { id } = await User.createFromGoogle({ googleId: identity.googleId, email: identity.email, name: identity.name });
    return loginRedirect(frontendUrl, 'google', id, true);
  } catch (err) {
    // Alta simultánea con el mismo email o la misma cuenta de Google
    if (err.code === 'P2002') return back(linking ? 'taken' : 'exists');
    return back('error');
  }
}

// --- Estado y desvinculación ------------------------------------------------------------

async function status(userId) {
  const methods = await User.findLoginMethods(userId);
  if (!methods) throw new HttpError(404, 'Usuario no encontrado');
  return {
    configured: isConfigured(),
    linked: Boolean(methods.googleId),
    // Sin contraseña ni Strava, Google es la única forma de entrar
    canUnlink: Boolean(methods.passwordHash || methods.stravaAthleteId),
  };
}

async function unlink(userId) {
  const { linked, canUnlink } = await status(userId);
  if (!linked) return;
  if (!canUnlink) {
    throw new HttpError(409, 'Tu cuenta entra con Google: si lo desvinculas no podrás volver a iniciar sesión');
  }
  await User.setGoogleId(userId, null);
}

module.exports = { buildLoginUrl, buildLinkUrl, handleCallback, status, unlink, isConfigured };
