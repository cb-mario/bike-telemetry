const { describe, it, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { app, prisma, request, resetDb, registerUser, PASSWORD } = require('./helpers/utils');
const { signToken } = require('../src/services/auth.service');

const FRONT = 'http://front.test';
const CLIENT_ID = 'google-client.apps.googleusercontent.com';
const nowSec = () => Math.floor(Date.now() / 1000);
const realFetch = globalThis.fetch;

// ID token de Google (el backend lo recibe por TLS desde el endpoint de tokens y valida sus claims)
const idToken = (claims = {}) => jwt.sign({
  iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'g-123', email: 'lucia@gmail.com',
  email_verified: true, name: 'Lucía Rueda', exp: nowSec() + 3600, ...claims,
}, 'firma-de-google');

// Simula el endpoint de tokens de Google; registra las peticiones
function mockGoogle(respond) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.hostname !== 'oauth2.googleapis.com') return realFetch(input, init);
    calls.push({ path: url.pathname, body: Object.fromEntries(new URLSearchParams(init.body)) });
    const [status, body] = respond();
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return calls;
}
const tokenOk = (claims) => () => [200, { access_token: 'x', id_token: idToken(claims) }];

const state = (payload) => jwt.sign(payload, process.env.JWT_SECRET);
const loginState = () => state({ purpose: 'google-login' });
const callback = (query) => request(app).get('/api/auth/google/callback').query(query).redirects(0);
const loginQuery = () => ({ code: 'abc', state: loginState() });

function ticketFrom(location) {
  const url = new URL(location);
  assert.equal(url.origin + url.pathname, `${FRONT}/entrar/google`);
  return new URLSearchParams(url.hash.slice(1)).get('ticket');
}
const exchange = (ticket) => request(app).post('/api/auth/exchange').send({ ticket });

describe('Iniciar sesión con Google', () => {
  beforeEach(resetDb);
  afterEach(() => { globalThis.fetch = realFetch; });
  after(() => prisma.$disconnect());

  it('GET /api/auth/google/url es pública y pide openid, email y perfil con state firmado', async () => {
    const res = await request(app).get('/api/auth/google/url');
    assert.equal(res.status, 200);
    const url = new URL(res.body.url);
    assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
    assert.equal(url.searchParams.get('client_id'), CLIENT_ID);
    assert.equal(url.searchParams.get('scope'), 'openid email profile');
    assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:3000/api/auth/google/callback');
    assert.equal(jwt.verify(url.searchParams.get('state'), process.env.JWT_SECRET).purpose, 'google-login');
  });

  it('sin credenciales de Google configuradas → 503', async () => {
    const saved = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    try {
      assert.equal((await request(app).get('/api/auth/google/url')).status, 503);
    } finally {
      process.env.GOOGLE_CLIENT_ID = saved;
    }
  });

  it('crea la cuenta con el email verificado y el nombre de Google y el ticket da una sesión', async () => {
    const calls = mockGoogle(tokenOk());
    const res = await callback(loginQuery());
    const { body } = await exchange(ticketFrom(res.headers.location));
    assert.equal(body.created, true);
    assert.equal(body.user.email, 'lucia@gmail.com');
    assert.equal(body.user.name, 'Lucía Rueda');
    assert.equal(calls[0].body.client_secret, 'google-secret');
    assert.equal(calls[0].body.grant_type, 'authorization_code');

    const user = await prisma.user.findUnique({ where: { googleId: 'g-123' } });
    assert.equal(user.passwordHash, null);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);
    assert.equal(me.body.user.id, user.id);
    assert.equal(JSON.stringify(me.body).includes('g-123'), false);
  });

  it('la segunda vez entra en la misma cuenta sin duplicarla', async () => {
    mockGoogle(tokenOk());
    await exchange(ticketFrom((await callback(loginQuery())).headers.location));
    const { body } = await exchange(ticketFrom((await callback(loginQuery())).headers.location));
    assert.equal(body.created, false);
    assert.equal(await prisma.user.count(), 1);
  });

  it('no une sola una cuenta con contraseña del mismo email (evita el secuestro previo de cuentas)', async () => {
    await registerUser('lucia@gmail.com');
    mockGoogle(tokenOk());
    const res = await callback(loginQuery());
    assert.equal(res.headers.location, `${FRONT}/?google_login=exists`);
    const user = await prisma.user.findUnique({ where: { email: 'lucia@gmail.com' } });
    assert.equal(user.googleId, null);
  });

  it('rechaza ID tokens de otra app, de otro emisor, caducados o sin email verificado', async () => {
    for (const claims of [{ aud: 'otra-app' }, { iss: 'https://evil.example' }, { exp: nowSec() - 60 }]) {
      mockGoogle(tokenOk(claims));
      assert.equal((await callback(loginQuery())).headers.location, `${FRONT}/?google_login=error`);
    }
    mockGoogle(tokenOk({ email_verified: false }));
    assert.equal((await callback(loginQuery())).headers.location, `${FRONT}/?google_login=unverified`);
    assert.equal(await prisma.user.count(), 0);
  });

  it('cancelar, state inválido o fallo de Google vuelven al login con el motivo', async () => {
    assert.equal((await callback({ error: 'access_denied', state: loginState() })).headers.location, `${FRONT}/?google_login=denied`);
    assert.equal((await callback({ code: 'abc', state: 'basura' })).headers.location, `${FRONT}/?google_login=error`);
    assert.equal((await callback({ code: 'abc', state: state({ purpose: 'strava-login' }) })).headers.location, `${FRONT}/?google_login=error`);
    mockGoogle(() => [400, { error: 'invalid_grant' }]);
    assert.equal((await callback(loginQuery())).headers.location, `${FRONT}/?google_login=error`);
  });

  describe('vincular desde el perfil', () => {
    let token;
    let userId;
    const auth = (req) => req.set('Authorization', `Bearer ${token}`);

    beforeEach(async () => {
      token = await registerUser('mario@test.local');
      userId = (await prisma.user.findUnique({ where: { email: 'mario@test.local' } })).id;
    });

    it('vincula la cuenta de Google y después se puede entrar con ella', async () => {
      const url = new URL((await auth(request(app).get('/api/auth/google/link-url'))).body.url);
      const linkState = url.searchParams.get('state');
      assert.equal(jwt.verify(linkState, process.env.JWT_SECRET).sub, String(userId));

      mockGoogle(tokenOk({ email: 'otro@gmail.com' }));
      const res = await callback({ code: 'abc', state: linkState });
      assert.equal(res.headers.location, `${FRONT}/perfil?google=linked`);
      assert.deepEqual((await auth(request(app).get('/api/auth/google/status'))).body,
        { configured: true, linked: true, canUnlink: true });

      const { body } = await exchange(ticketFrom((await callback(loginQuery())).headers.location));
      assert.equal(body.user.email, 'mario@test.local');
    });

    it('no vincula una cuenta de Google que ya usa otro usuario', async () => {
      await prisma.user.create({ data: { email: 'lucia@gmail.com', googleId: 'g-123' } });
      mockGoogle(tokenOk());
      const res = await callback({ code: 'abc', state: state({ purpose: 'google-link', sub: String(userId) }) });
      assert.equal(res.headers.location, `${FRONT}/perfil?google=taken`);
    });

    it('link-url, status y desvincular requieren sesión', async () => {
      assert.equal((await request(app).get('/api/auth/google/link-url')).status, 401);
      assert.equal((await request(app).get('/api/auth/google/status')).status, 401);
      assert.equal((await request(app).delete('/api/auth/google')).status, 401);
    });

    it('desvincula si hay contraseña; una cuenta solo de Google no puede quedarse sin acceso', async () => {
      await prisma.user.update({ where: { id: userId }, data: { googleId: 'g-mario' } });
      assert.equal((await auth(request(app).delete('/api/auth/google'))).status, 204);
      assert.equal((await prisma.user.findUnique({ where: { id: userId } })).googleId, null);

      mockGoogle(tokenOk());
      const { body } = await exchange(ticketFrom((await callback(loginQuery())).headers.location));
      const status = await request(app).get('/api/auth/google/status').set('Authorization', `Bearer ${body.token}`);
      assert.equal(status.body.canUnlink, false);
      const res = await request(app).delete('/api/auth/google').set('Authorization', `Bearer ${body.token}`);
      assert.equal(res.status, 409);
      // Y no entra con contraseña
      assert.equal((await request(app).post('/api/auth/login').send({ email: 'lucia@gmail.com', password: PASSWORD })).status, 401);
    });

    it('una cuenta de Strava con Google vinculado sí puede desconectar Strava', async () => {
      const user = await prisma.user.create({ data: { stravaAthleteId: '99', googleId: 'g-9' } });
      const t = signToken(user);
      const status = await request(app).get('/api/strava/status').set('Authorization', `Bearer ${t}`);
      assert.equal(status.body.canDisconnect, true);
    });
  });
});
