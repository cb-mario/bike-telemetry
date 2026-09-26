const { describe, it, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { app, prisma, request, resetDb, registerUser, PASSWORD } = require('./helpers/utils');
const { signToken } = require('../src/services/auth.service');
const { mockStrava, restoreFetch } = require('./helpers/stravaMock');
const { decrypt, encrypt } = require('../src/utils/crypto');

const FRONT = 'http://front.test';
const nowSec = () => Math.floor(Date.now() / 1000);
const ATHLETE = { id: 4242, firstname: 'Ana', lastname: 'Pedal', sex: 'F' };

const tokenResponse = (overrides = {}) => [200, {
  access_token: 'access-1', refresh_token: 'refresh-1', expires_at: nowSec() + 6 * 3600, athlete: ATHLETE, ...overrides,
}];

const loginState = () => jwt.sign({ purpose: 'strava-login' }, process.env.JWT_SECRET);
const callback = (query) => request(app).get('/api/strava/callback').query(query).redirects(0);
const okQuery = () => ({ code: 'abc', scope: 'read,activity:read_all', state: loginState() });

// Ticket que deja el callback en el fragmento de la URL del frontend
function ticketFrom(location) {
  const url = new URL(location);
  assert.equal(url.origin + url.pathname, `${FRONT}/entrar/strava`);
  return new URLSearchParams(url.hash.slice(1)).get('ticket');
}

describe('Iniciar sesión con Strava', () => {
  beforeEach(resetDb);
  afterEach(restoreFetch);
  after(() => prisma.$disconnect());

  it('GET /api/auth/strava/url es pública y firma un state de login', async () => {
    const res = await request(app).get('/api/auth/strava/url');
    assert.equal(res.status, 200);
    const url = new URL(res.body.url);
    assert.equal(url.searchParams.get('scope'), 'read,activity:read_all');
    const state = jwt.verify(url.searchParams.get('state'), process.env.JWT_SECRET);
    assert.equal(state.purpose, 'strava-login');
    assert.equal(state.sub, undefined);
  });

  it('crea la cuenta con nombre y sexo de Strava, guarda los tokens cifrados y el ticket da una sesión', async () => {
    mockStrava({ 'POST /oauth/token': () => tokenResponse() });
    const res = await callback(okQuery());
    assert.equal(res.status, 302);
    const ticket = ticketFrom(res.headers.location);

    const user = await prisma.user.findUnique({ where: { stravaAthleteId: '4242' } });
    assert.equal(user.email, null);
    assert.equal(user.passwordHash, null);
    assert.equal(user.name, 'Ana Pedal');
    assert.equal(user.sex, 'female');
    assert.equal(decrypt(user.stravaRefreshToken), 'refresh-1');

    const exchange = await request(app).post('/api/auth/exchange').send({ ticket });
    assert.equal(exchange.status, 200);
    assert.equal(exchange.body.created, true);
    assert.equal(exchange.body.user.name, 'Ana Pedal');
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${exchange.body.token}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.id, user.id);
  });

  it('si el atleta ya está vinculado entra en esa cuenta (sin duplicarla) y renueva los tokens', async () => {
    await registerUser('ana@test.local');
    await prisma.user.update({ where: { email: 'ana@test.local' }, data: { stravaAthleteId: '4242' } });
    mockStrava({ 'POST /oauth/token': () => tokenResponse({ refresh_token: 'refresh-2' }) });

    const ticket = ticketFrom((await callback(okQuery())).headers.location);
    const exchange = await request(app).post('/api/auth/exchange').send({ ticket });
    assert.equal(exchange.body.created, false);
    assert.equal(exchange.body.user.email, 'ana@test.local');
    assert.equal(await prisma.user.count(), 1);
    const user = await prisma.user.findUnique({ where: { email: 'ana@test.local' } });
    assert.equal(decrypt(user.stravaRefreshToken), 'refresh-2');
  });

  it('cancelar, no dar permiso de actividades o un fallo de Strava vuelven al login con el motivo', async () => {
    let res = await callback({ error: 'access_denied', state: loginState() });
    assert.equal(res.headers.location, `${FRONT}/entrar?strava_login=denied`);

    res = await callback({ ...okQuery(), scope: 'read' });
    assert.equal(res.headers.location, `${FRONT}/entrar?strava_login=scope`);

    mockStrava({ 'POST /oauth/token': () => [400, { message: 'Bad Request' }] });
    res = await callback(okQuery());
    assert.equal(res.headers.location, `${FRONT}/entrar?strava_login=error`);
    assert.equal(await prisma.user.count(), 0);
  });

  it('rechaza tickets inválidos, caducados o con otro propósito', async () => {
    const exchange = (ticket) => request(app).post('/api/auth/exchange').send({ ticket });
    assert.equal((await exchange('basura')).status, 401);
    assert.equal((await exchange(undefined)).status, 401);
    const expired = jwt.sign({ sub: '1', purpose: 'login-ticket', exp: nowSec() - 10 }, process.env.JWT_SECRET);
    assert.equal((await exchange(expired)).status, 401);
    // El state del flujo de conexión no sirve como ticket de sesión
    const connectState = jwt.sign({ sub: '1', purpose: 'strava-oauth' }, process.env.JWT_SECRET);
    assert.equal((await exchange(connectState)).status, 401);
  });

  it('una cuenta creada con Strava no puede desconectarlo ni entrar con contraseña', async () => {
    mockStrava({ 'POST /oauth/token': () => tokenResponse() });
    const ticket = ticketFrom((await callback(okQuery())).headers.location);
    const { token } = (await request(app).post('/api/auth/exchange').send({ ticket })).body;
    const auth = (req) => req.set('Authorization', `Bearer ${token}`);

    const status = await auth(request(app).get('/api/strava/status'));
    assert.equal(status.body.connected, true);
    assert.equal(status.body.canDisconnect, false);

    const res = await auth(request(app).post('/api/strava/disconnect'));
    assert.equal(res.status, 409);
    assert.match(res.body.error, /no podrás volver a iniciar sesión/);

    // Ni la contraseña de relleno ni una vacía abren una cuenta sin contraseña
    const login = await request(app).post('/api/auth/login').send({ email: 'x@test.local', password: PASSWORD });
    assert.equal(login.status, 401);
  });

  it('si Strava revoca el acceso, la cuenta sin contraseña conserva el atleta para volver a entrar', async () => {
    const user = await prisma.user.create({
      data: {
        stravaAthleteId: '4242', stravaAccessToken: encrypt('access-1'), stravaRefreshToken: encrypt('refresh-1'),
        stravaTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });
    const token = signToken(user);
    mockStrava({ '/api/v3/athlete/activities': () => [401, { message: 'Authorization Error' }] });

    const res = await request(app).post('/api/strava/sync').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 409);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(after.stravaAthleteId, '4242');
    assert.equal(after.stravaRefreshToken, null);
  });
});
