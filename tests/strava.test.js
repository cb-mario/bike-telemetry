const { describe, it, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { app, prisma, request, resetDb, registerUser } = require('./helpers/utils');
const { mockStrava, restoreFetch, stravaActivity } = require('./helpers/stravaMock');
const { decrypt } = require('../src/utils/crypto');

const FRONT = 'http://front.test/salidas';
const nowSec = () => Math.floor(Date.now() / 1000);

const tokenResponse = (overrides = {}) => [200, {
  access_token: 'access-1', refresh_token: 'refresh-1', expires_at: nowSec() + 6 * 3600,
  athlete: { id: 777 }, ...overrides,
}];

const stateFor = (userId, extra = {}) => jwt.sign({ sub: String(userId), purpose: 'strava-oauth', ...extra }, process.env.JWT_SECRET);

describe('Strava', () => {
  let token;
  let userId;
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);

  beforeEach(async () => {
    await resetDb();
    token = await registerUser('rider@test.local');
    userId = (await prisma.user.findUnique({ where: { email: 'rider@test.local' } })).id;
  });
  afterEach(restoreFetch);
  after(() => prisma.$disconnect());

  // Vincula al usuario directamente en BD (como si ya hubiera pasado por OAuth)
  async function connect({ expiresInSec = 6 * 3600 } = {}) {
    const { encrypt } = require('../src/utils/crypto');
    await prisma.user.update({
      where: { id: userId },
      data: {
        stravaAthleteId: '777',
        stravaAccessToken: encrypt('access-1'),
        stravaRefreshToken: encrypt('refresh-1'),
        stravaTokenExpiresAt: new Date(Date.now() + expiresInSec * 1000),
      },
    });
  }

  describe('GET /api/strava/auth-url', () => {
    it('genera la URL de autorización con scopes y state firmado', async () => {
      const res = await auth(request(app).get('/api/strava/auth-url'));
      assert.equal(res.status, 200);
      const url = new URL(res.body.url);
      assert.equal(url.origin + url.pathname, 'https://www.strava.com/oauth/authorize');
      assert.equal(url.searchParams.get('client_id'), '12345');
      assert.equal(url.searchParams.get('scope'), 'read,activity:read_all');
      assert.equal(url.searchParams.get('response_type'), 'code');
      assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:3000/api/strava/callback');
      const state = jwt.verify(url.searchParams.get('state'), process.env.JWT_SECRET);
      assert.equal(state.sub, String(userId));
    });

    it('sin credenciales de Strava configuradas → 503', async () => {
      const saved = process.env.STRAVA_CLIENT_ID;
      delete process.env.STRAVA_CLIENT_ID;
      try {
        const res = await auth(request(app).get('/api/strava/auth-url'));
        assert.equal(res.status, 503);
        assert.match(res.body.error, /no está configurada/);
      } finally {
        process.env.STRAVA_CLIENT_ID = saved;
      }
    });

    it('requiere autenticación', async () => {
      assert.equal((await request(app).get('/api/strava/auth-url')).status, 401);
    });
  });

  describe('GET /api/strava/callback', () => {
    const callback = (query) => request(app).get('/api/strava/callback').query(query).redirects(0);

    it('intercambia el código, guarda los tokens cifrados y redirige al frontend', async () => {
      const calls = mockStrava({ 'POST /oauth/token': () => tokenResponse() });
      const res = await callback({ code: 'abc', scope: 'read,activity:read_all', state: stateFor(userId) });

      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `${FRONT}?strava=connected`);
      assert.deepEqual(calls[0].body, {
        client_id: '12345', client_secret: 'strava-secret', code: 'abc', grant_type: 'authorization_code',
      });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      assert.equal(user.stravaAthleteId, '777');
      assert.notEqual(user.stravaAccessToken, 'access-1'); // cifrado en BD
      assert.equal(decrypt(user.stravaAccessToken), 'access-1');
      assert.equal(decrypt(user.stravaRefreshToken), 'refresh-1');
    });

    const redirects = [
      ['el usuario deniega el acceso', { error: 'access_denied' }, 'denied'],
      ['state falsificado', { code: 'abc', scope: 'activity:read_all', state: jwt.sign({ sub: '1', purpose: 'strava-oauth' }, 'otro') }, 'error'],
      ['state de otro propósito', { code: 'abc', scope: 'activity:read_all', state: 'PLACEHOLDER_OTHER' }, 'error'],
      ['sin permiso de actividades', { code: 'abc', scope: 'read', state: 'PLACEHOLDER' }, 'scope'],
    ];
    for (const [name, query, status] of redirects) {
      it(`${name} → ?strava=${status}`, async () => {
        const calls = mockStrava({ 'POST /oauth/token': () => tokenResponse() });
        const q = { ...query };
        if (q.state === 'PLACEHOLDER') q.state = stateFor(userId);
        if (q.state === 'PLACEHOLDER_OTHER') q.state = jwt.sign({ sub: String(userId), purpose: 'login' }, process.env.JWT_SECRET);
        const res = await callback(q);
        assert.equal(res.headers.location, `${FRONT}?strava=${status}`);
        assert.equal(calls.length, 0);
      });
    }

    it('una cuenta de Strava ya vinculada a otro usuario → ?strava=taken', async () => {
      await registerUser('otro@test.local');
      await prisma.user.update({ where: { email: 'otro@test.local' }, data: { stravaAthleteId: '777' } });
      mockStrava({ 'POST /oauth/token': () => tokenResponse() });
      const res = await callback({ code: 'abc', scope: 'activity:read_all', state: stateFor(userId) });
      assert.equal(res.headers.location, `${FRONT}?strava=taken`);
    });

    it('Strava rechaza el código → ?strava=error', async () => {
      mockStrava({ 'POST /oauth/token': () => [400, { message: 'Bad Request' }] });
      const res = await callback({ code: 'caducado', scope: 'activity:read_all', state: stateFor(userId) });
      assert.equal(res.headers.location, `${FRONT}?strava=error`);
    });
  });

  describe('POST /api/strava/sync', () => {
    const sync = () => auth(request(app).post('/api/strava/sync'));

    it('sin conectar → 409', async () => {
      assert.equal((await sync()).status, 409);
    });

    it('importa solo salidas en bici y mapea los campos', async () => {
      await connect();
      const calls = mockStrava({
        '/api/v3/athlete/activities': () => [200, [
          stravaActivity(),
          stravaActivity({ id: 1002, type: 'VirtualRide', sport_type: 'VirtualRide', name: 'Zwift', map: { summary_polyline: '' } }),
          stravaActivity({ id: 1003, type: 'Run', sport_type: 'Run' }),
          stravaActivity({ id: 1004, sport_type: 'GravelRide', has_heartrate: false }),
          stravaActivity({ id: 1005, distance: 0, name: 'Rodillo sin distancia' }),
        ]],
      });

      const res = await sync();
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.imported, 3);
      assert.equal(res.body.skippedNotRides, 1);
      assert.equal(res.body.skippedInvalid, 1);
      assert.equal(calls[0].query.per_page, '30');
      assert.equal(calls[0].headers.Authorization, 'Bearer access-1');

      const ride = await prisma.activity.findUnique({ where: { stravaId: '1001' } });
      assert.equal(ride.title, 'Morning Ride');
      assert.equal(ride.source, 'strava');
      assert.equal(ride.sportType, 'Ride');
      assert.equal(ride.distanceKm, 42.2);
      assert.equal(ride.durationMin, 90);
      assert.equal(ride.elevationGain, 612);
      assert.equal(ride.avgHr, 142);
      assert.equal(ride.maxHr, 178);
      assert.equal(ride.maxSpeedKmh, 55);
      assert.equal(ride.date.toISOString(), '2026-09-20T07:00:00.000Z');
      assert.equal(ride.summaryPolyline, '_p~iF~ps|U_ulLnnqC_mqNvxq`@');

      const gravel = await prisma.activity.findUnique({ where: { stravaId: '1004' } });
      assert.equal(gravel.sportType, 'GravelRide');
      assert.equal(gravel.avgHr, null);

      const status = await auth(request(app).get('/api/strava/status'));
      assert.ok(status.body.lastSyncAt);
    });

    it('no duplica actividades al sincronizar de nuevo', async () => {
      await connect();
      mockStrava({ '/api/v3/athlete/activities': () => [200, [stravaActivity(), stravaActivity({ id: 1002 })]] });
      await sync();
      const res = await sync();
      assert.equal(res.body.imported, 0);
      assert.equal(res.body.alreadyImported, 2);
      assert.equal(await prisma.activity.count(), 2);
    });

    it('renueva el token si ha caducado antes de llamar a la API', async () => {
      await connect({ expiresInSec: -60 });
      const calls = mockStrava({
        'POST /oauth/token': () => tokenResponse({ access_token: 'access-2', refresh_token: 'refresh-2' }),
        '/api/v3/athlete/activities': () => [200, []],
      });
      assert.equal((await sync()).status, 200);
      assert.deepEqual(calls[0].body, {
        client_id: '12345', client_secret: 'strava-secret', grant_type: 'refresh_token', refresh_token: 'refresh-1',
      });
      assert.equal(calls[1].headers.Authorization, 'Bearer access-2');
      const user = await prisma.user.findUnique({ where: { id: userId } });
      assert.equal(decrypt(user.stravaRefreshToken), 'refresh-2');
    });

    it('limpia valores de pulso imposibles en lugar de descartar la salida', async () => {
      await connect();
      mockStrava({ '/api/v3/athlete/activities': () => [200, [stravaActivity({ average_heartrate: 150, max_heartrate: 243 })]] });
      await sync();
      const ride = await prisma.activity.findFirst();
      assert.equal(ride.avgHr, 150);
      assert.equal(ride.maxHr, null);
    });

    it('acceso revocado en Strava (401) → desvincula y responde 409', async () => {
      await connect();
      mockStrava({ '/api/v3/athlete/activities': () => [401, { message: 'Authorization Error' }] });
      const res = await sync();
      assert.equal(res.status, 409);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      assert.equal(user.stravaAthleteId, null);
      assert.equal(user.stravaAccessToken, null);
    });

    it('límite de peticiones de Strava → 429', async () => {
      await connect();
      mockStrava({ '/api/v3/athlete/activities': () => [429, { message: 'Rate Limit Exceeded' }] });
      assert.equal((await sync()).status, 429);
    });
  });

  describe('track de una actividad de Strava', () => {
    it('se descarga de Strava la primera vez y después se sirve desde la BD', async () => {
      await connect();
      const calls = mockStrava({
        '/api/v3/athlete/activities': () => [200, [stravaActivity()]],
        '/api/v3/activities/1001/streams': () => [200, {
          latlng: { data: [[40, -3], [40.001, -3], [40.002, -3]] },
          altitude: { data: [600, 605, 610] },
          time: { data: [0, 20, 40] },
          heartrate: { data: [120, 130, 250] },
        }],
      });
      await auth(request(app).post('/api/strava/sync'));
      const activity = await prisma.activity.findFirst();

      const first = await auth(request(app).get(`/api/activities/${activity.id}/track`));
      assert.equal(first.status, 200, JSON.stringify(first.body));
      assert.deepEqual(first.body.segments[0][1], [40.001, -3, 605, 20, 130]);
      assert.equal(first.body.segments[0][2][4], null); // FC imposible descartada

      await auth(request(app).get(`/api/activities/${activity.id}/track`));
      assert.equal(calls.filter((c) => c.path.endsWith('/streams')).length, 1);
    });
  });

  it('status y desconexión', async () => {
    let res = await auth(request(app).get('/api/strava/status'));
    assert.deepEqual(res.body, { configured: true, connected: false, athleteId: null, lastSyncAt: null, canDisconnect: true });

    await connect();
    const calls = mockStrava({ 'POST /oauth/deauthorize': () => [200, {}] });
    res = await auth(request(app).get('/api/strava/status'));
    assert.equal(res.body.connected, true);

    assert.equal((await auth(request(app).post('/api/strava/disconnect'))).status, 204);
    assert.equal(calls[0].path, '/oauth/deauthorize');
    res = await auth(request(app).get('/api/strava/status'));
    assert.equal(res.body.connected, false);
  });

  it('nunca expone los tokens en /api/auth/me', async () => {
    await connect();
    const me = await auth(request(app).get('/api/auth/me'));
    assert.equal(JSON.stringify(me.body).includes('strava'), false);
  });
});
