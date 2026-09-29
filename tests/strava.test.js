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
    await prisma.connection.create({
      data: {
        userId,
        provider: 'strava',
        account: '777',
        accessToken: encrypt('access-1'),
        refreshToken: encrypt('refresh-1'),
        tokenExpiresAt: new Date(Date.now() + expiresInSec * 1000),
      },
    });
  }

  const stravaStatus = async () => (await auth(request(app).get('/api/connections'))).body.find((c) => c.provider === 'strava');
  const stravaConnection = () => prisma.connection.findUnique({ where: { userId_provider: { userId, provider: 'strava' } } });
  // Actividad importada de la salida de Strava con ese id
  const byStravaId = (externalId) => prisma.activity.findFirst({ where: { imports: { some: { provider: 'strava', externalId } } } });

  describe('POST /api/connections/strava/connect', () => {
    it('genera la URL de autorización con scopes y state firmado', async () => {
      const res = await auth(request(app).post('/api/connections/strava/connect'));
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
        const res = await auth(request(app).post('/api/connections/strava/connect'));
        assert.equal(res.status, 503);
        assert.match(res.body.error, /Strava no está disponible/);
      } finally {
        process.env.STRAVA_CLIENT_ID = saved;
      }
    });

    it('requiere autenticación', async () => {
      assert.equal((await request(app).post('/api/connections/strava/connect')).status, 401);
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

      const conn = await stravaConnection();
      assert.equal(conn.account, '777');
      assert.notEqual(conn.accessToken, 'access-1'); // cifrado en BD
      assert.equal(decrypt(conn.accessToken), 'access-1');
      assert.equal(decrypt(conn.refreshToken), 'refresh-1');
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
      const other = await prisma.user.findUnique({ where: { email: 'otro@test.local' } });
      await prisma.connection.create({ data: { userId: other.id, provider: 'strava', account: '777' } });
      mockStrava({ 'POST /oauth/token': () => tokenResponse() });
      const res = await callback({ code: 'abc', scope: 'activity:read_all', state: stateFor(userId) });
      assert.equal(res.headers.location, `${FRONT}?strava=taken`);
    });

    it('el antiguo "Continuar con Strava" ya no crea cuentas ni abre sesión', async () => {
      const calls = mockStrava({ 'POST /oauth/token': () => tokenResponse({ athlete: { id: 888 } }) });
      const res = await callback({ code: 'abc', scope: 'activity:read_all', state: jwt.sign({ purpose: 'strava-login' }, process.env.JWT_SECRET) });
      assert.equal(res.headers.location, `${FRONT}?strava=error`);
      assert.equal(calls.length, 0);
      assert.equal(await prisma.user.count(), 1);
      assert.equal((await request(app).get('/api/auth/strava/url')).status, 404);
    });

    it('Strava rechaza el código → ?strava=error', async () => {
      mockStrava({ 'POST /oauth/token': () => [400, { message: 'Bad Request' }] });
      const res = await callback({ code: 'caducado', scope: 'activity:read_all', state: stateFor(userId) });
      assert.equal(res.headers.location, `${FRONT}?strava=error`);
    });
  });

  describe('POST /api/connections/strava/sync', () => {
    const sync = () => auth(request(app).post('/api/connections/strava/sync'));

    it('sin conectar → 409', async () => {
      assert.equal((await sync()).status, 409);
    });

    it('importa solo salidas en bici y mapea los campos', async () => {
      await connect();
      const calls = mockStrava({
        '/api/v3/athlete/activities': () => [200, [
          stravaActivity(),
          stravaActivity({ id: 1002, type: 'VirtualRide', sport_type: 'VirtualRide', name: 'Zwift', map: { summary_polyline: '' }, start_date: '2026-09-19T18:00:00Z' }),
          stravaActivity({ id: 1003, type: 'Run', sport_type: 'Run', start_date: '2026-09-18T18:00:00Z' }),
          stravaActivity({ id: 1004, sport_type: 'GravelRide', has_heartrate: false, start_date: '2026-09-17T08:00:00Z' }),
          stravaActivity({ id: 1005, distance: 0, name: 'Rodillo sin distancia', start_date: '2026-09-16T18:00:00Z' }),
        ]],
      });

      const res = await sync();
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.imported, 3);
      assert.equal(res.body.skippedNotRides, 1);
      assert.equal(res.body.skippedInvalid, 1);
      assert.equal(calls[0].query.per_page, '100');
      assert.equal(res.body.hasMore, false);
      assert.equal(calls[0].headers.Authorization, 'Bearer access-1');

      const ride = await byStravaId('1001');
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

      const gravel = await byStravaId('1004');
      assert.equal(gravel.sportType, 'GravelRide');
      assert.equal(gravel.avgHr, null);

      assert.ok((await stravaStatus()).lastSyncAt);
    });

    it('no duplica actividades al sincronizar de nuevo', async () => {
      await connect();
      mockStrava({ '/api/v3/athlete/activities': () => [200, [stravaActivity(), stravaActivity({ id: 1002, start_date: '2026-09-21T07:00:00Z' })]] });
      await sync();
      const res = await sync();
      assert.equal(res.body.imported, 0);
      assert.equal(res.body.alreadyImported, 2);
      assert.equal(await prisma.activity.count(), 2);
    });

    it('una salida que ya estaba por otra vía (misma hora ±2 min) no se duplica: se enlaza', async () => {
      await connect();
      // La misma salida registrada antes a mano (p. ej. desde un .gpx), 1 minuto de diferencia
      const existing = await prisma.activity.create({
        data: { userId, title: 'Del GPX', date: new Date('2026-09-20T07:01:00Z'), distanceKm: 42, durationMin: 90, source: 'gpx' },
      });
      mockStrava({ '/api/v3/athlete/activities': () => [200, [stravaActivity(), stravaActivity({ id: 1002, start_date: '2026-09-20T07:05:00Z' })]] });

      const res = await sync();
      assert.equal(res.body.imported, 1); // la de las 7:05 sí es otra salida
      assert.equal(res.body.duplicates, 1);
      assert.equal(await prisma.activity.count(), 2);
      assert.equal((await byStravaId('1001')).id, existing.id);
      assert.equal((await byStravaId('1001')).title, 'Del GPX'); // se conservan los datos que había

      // La siguiente sincronización ya la da por importada
      const again = await sync();
      assert.equal(again.body.duplicates, 0);
      assert.equal(again.body.alreadyImported, 2);
    });

    it('la salida de otro usuario a la misma hora no cuenta como duplicada', async () => {
      await registerUser('otro@test.local');
      const other = await prisma.user.findUnique({ where: { email: 'otro@test.local' } });
      await prisma.activity.create({
        data: { userId: other.id, title: 'Ajena', date: new Date('2026-09-20T07:00:00Z'), distanceKm: 42, durationMin: 90 },
      });
      await connect();
      mockStrava({ '/api/v3/athlete/activities': () => [200, [stravaActivity()]] });
      const res = await sync();
      assert.equal(res.body.imported, 1);
      assert.equal(res.body.duplicates, 0);
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
      assert.equal(decrypt((await stravaConnection()).refreshToken), 'refresh-2');
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
      assert.equal(await stravaConnection(), null);
    });

    it('límite de peticiones de Strava → 429', async () => {
      await connect();
      mockStrava({ '/api/v3/athlete/activities': () => [429, { message: 'Rate Limit Exceeded' }] });
      assert.equal((await sync()).status, 429);
    });

    describe('historial largo (paginación)', () => {
      // Strava simulado con `total` salidas, de la más reciente a la más antigua (una por hora)
      const history = (total) => Array.from({ length: total }, (_, i) => stravaActivity({
        id: 10000 + total - i,
        start_date: new Date(Date.UTC(2026, 8, 20) - i * 3600 * 1000).toISOString().replace('.000', ''),
      }));
      const mockHistory = (list) => mockStrava({
        '/api/v3/athlete/activities': ({ query }) => {
          const before = query.before ? Number(query.before) * 1000 : Infinity;
          const visible = list.filter((s) => Date.parse(s.start_date) < before);
          const size = Number(query.per_page);
          const start = (Number(query.page) - 1) * size;
          return [200, visible.slice(start, start + size)];
        },
      });

      it('trae todas las páginas del historial', async () => {
        await connect();
        const calls = mockHistory(history(250));
        const res = await sync();
        assert.equal(res.body.imported, 250);
        assert.equal(res.body.hasMore, false);
        assert.deepEqual(calls.map((c) => c.query.page), ['1', '2', '3']);
        assert.equal(await prisma.activity.count(), 250);
      });

      it('como mucho 10 páginas por vez; la siguiente sincronización sigue donde lo dejó', async () => {
        await connect();
        const list = history(1150);
        let calls = mockHistory(list);
        let res = await sync();
        assert.equal(calls.length, 10);
        assert.equal(res.body.imported, 1000);
        assert.equal(res.body.hasMore, true);

        calls = mockHistory(list);
        res = await sync();
        assert.equal(res.body.imported, 150);
        assert.equal(res.body.hasMore, false);
        // Una página para ver que no hay nada nuevo y el resto, anteriores a la más antigua importada
        assert.equal(calls[0].query.before, undefined);
        assert.ok(calls.slice(1).every((c) => c.query.before));
        assert.equal(await prisma.activity.count(), 1150);
      });

      it('una sincronización normal solo trae lo nuevo', async () => {
        await connect();
        const list = history(120);
        mockHistory(list);
        await sync();

        const newer = [stravaActivity({ id: 99999, start_date: '2026-09-21T07:00:00Z' }), ...list];
        const calls = mockHistory(newer);
        const res = await sync();
        assert.equal(res.body.imported, 1);
        assert.equal(res.body.hasMore, false);
        assert.ok(calls.length <= 2, `${calls.length} peticiones`);
      });
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
      await auth(request(app).post('/api/connections/strava/sync'));
      const activity = await prisma.activity.findFirst();

      const first = await auth(request(app).get(`/api/activities/${activity.id}/track`));
      assert.equal(first.status, 200, JSON.stringify(first.body));
      assert.deepEqual(first.body.segments[0][1], [40.001, -3, 605, 20, 130]);
      assert.equal(first.body.segments[0][2][4], null); // FC imposible descartada

      await auth(request(app).get(`/api/activities/${activity.id}/track`));
      assert.equal(calls.filter((c) => c.path.endsWith('/streams')).length, 1);
    });
  });

  it('estado en /api/connections y desconexión', async () => {
    assert.deepEqual(await stravaStatus(), {
      provider: 'strava', name: 'Strava', auth: 'oauth', configured: true, connected: false, account: null, lastSyncAt: null,
    });

    await connect();
    const calls = mockStrava({ 'POST /oauth/deauthorize': () => [200, {}] });
    assert.equal((await stravaStatus()).connected, true);
    assert.equal((await stravaStatus()).account, '777');

    assert.equal((await auth(request(app).delete('/api/connections/strava'))).status, 204);
    assert.equal(calls[0].path, '/oauth/deauthorize');
    assert.equal((await stravaStatus()).connected, false);
    assert.equal(await stravaConnection(), null);
  });

  describe('/api/connections', () => {
    it('requiere autenticación', async () => {
      assert.equal((await request(app).get('/api/connections')).status, 401);
    });

    it('servicio desconocido → 404', async () => {
      const res = await auth(request(app).post('/api/connections/nope/sync'));
      assert.equal(res.status, 404);
      assert.match(res.body.error, /Servicio no encontrado/);
    });

    it('Strava apagado (sin STRAVA_ENABLED=true) → configured: false y 503 al conectar o sincronizar', async () => {
      process.env.STRAVA_ENABLED = 'false';
      try {
        assert.equal((await stravaStatus()).configured, false);
        assert.equal((await auth(request(app).post('/api/connections/strava/connect'))).status, 503);
        assert.equal((await auth(request(app).post('/api/connections/strava/sync'))).status, 503);
      } finally {
        process.env.STRAVA_ENABLED = 'true';
      }
    });

    it('las rutas antiguas de /api/strava ya no existen (salvo el callback)', async () => {
      for (const path of ['/api/strava/status', '/api/strava/auth-url']) {
        assert.equal((await auth(request(app).get(path))).status, 404);
      }
    });
  });

  it('nunca expone los tokens en /api/auth/me', async () => {
    await connect();
    const me = await auth(request(app).get('/api/auth/me'));
    assert.equal(JSON.stringify(me.body).includes('strava'), false);
  });
});
