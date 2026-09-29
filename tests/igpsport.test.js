const { describe, it, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { app, prisma, request, resetDb, registerUser } = require('./helpers/utils');
const { straightSegment } = require('./helpers/gpx');
const { buildFit } = require('./helpers/fit');
const { json } = require('./helpers/stravaMock');

const API = 'prod.en.igpsport.com';
const FILES = 'files.igpsport.test';
const realFetch = globalThis.fetch;

// JWT sin firmar con caducidad (el servicio solo lee "exp")
const jwt = (exp) => ['e30', Buffer.from(JSON.stringify({ exp })).toString('base64url'), 'x'].join('.');
const TOKEN = jwt(Math.floor(Date.now() / 1000) + 3600);

const rideAt = (iso, n = 30) => [straightSegment({ n, start: new Date(iso), hr: () => 130 })];

// iGPSPORT simulado: cuenta con salidas { rideId, title, fit } y registro de llamadas
function mockIgpsport({ rides = [], password = 'secreta', expired = false, detailFails = [] } = {}) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname !== API && url.hostname !== FILES) return realFetch(input, init);
    const path = url.pathname;
    const auth = init.headers?.authorization;
    calls.push({ path, query: Object.fromEntries(url.searchParams), auth, body: init.body && JSON.parse(init.body) });

    if (url.hostname === FILES) {
      const ride = rides.find((r) => path === `/${r.rideId}.fit`);
      return ride ? new Response(ride.fit) : new Response('no', { status: 404 });
    }
    if (path === '/service/auth/account/login') {
      const body = JSON.parse(init.body);
      // Así responde el servidor real a una contraseña errónea
      if (body.password !== password) return json(403, { code: 1002, message: 'Password error' });
      return json(200, { code: 0, data: { access_token: TOKEN } });
    }
    if (auth !== `Bearer ${TOKEN}` || expired) return json(401, { code: 401, message: 'Unauthorized' });

    if (path.endsWith('/activity/queryMyActivity')) {
      const page = Number(url.searchParams.get('pageNo'));
      const size = Number(url.searchParams.get('pageSize'));
      const rows = rides.slice((page - 1) * size, page * size).map((r) => ({ rideId: r.rideId, title: r.title }));
      return json(200, { code: 0, data: { rows, totalRows: rides.length } });
    }
    const detail = path.match(/queryActivityDetail\/(\d+)$/);
    if (detail) {
      if (detailFails.includes(Number(detail[1]))) return json(200, { code: 500, message: 'error' });
      return json(200, { code: 0, data: { fitUrl: `https://${FILES}/${detail[1]}.fit` } });
    }
    const download = path.match(/getDownloadUrl\/(\d+)$/);
    if (download) return json(200, { code: 0, data: `https://${FILES}/${download[1]}.fit` });
    return json(404, { code: 404, message: 'Not Found' });
  };
  return calls;
}

describe('iGPSPORT', () => {
  let token;
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  const connect = (body = { email: 'yo@igp.test', password: 'secreta' }) =>
    auth(request(app).post('/api/connections/igpsport/connect')).send(body);
  const sync = () => auth(request(app).post('/api/connections/igpsport/sync'));
  const status = async () => (await auth(request(app).get('/api/connections'))).body.find((c) => c.provider === 'igpsport');
  const connection = () => prisma.connection.findFirst({ where: { provider: 'igpsport' } });
  // rideIds de iGPSPORT anotados en cada actividad, de la más reciente a la más antigua
  const importedIds = async () => (await prisma.activity.findMany({
    orderBy: { date: 'desc' }, include: { imports: { where: { provider: 'igpsport' }, orderBy: { externalId: 'asc' } } },
  })).map((a) => a.imports.map((i) => i.externalId));

  beforeEach(async () => {
    await resetDb();
    token = await registerUser('igp@test.local');
  });
  afterEach(() => { globalThis.fetch = realFetch; });
  after(() => prisma.$disconnect());

  it('conecta con email y contraseña y guarda solo el token, cifrado', async () => {
    const calls = mockIgpsport();
    const res = await connect();
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.account, 'yo@igp.test');
    assert.deepEqual(calls[0].body, { appId: 'igpsport-web', username: 'yo@igp.test', password: 'secreta' });
    assert.equal((await status()).connected, true);

    const conn = await connection();
    assert.match(conn.accessToken, /^v1:/);
    assert.ok(!conn.accessToken.includes(TOKEN));
    assert.ok(!JSON.stringify(conn).includes('secreta'), 'la contraseña no se guarda');
    assert.ok(Math.abs(conn.tokenExpiresAt.getTime() - (Date.now() + 3600_000)) < 5000);
  });

  it('rechaza credenciales incorrectas o incompletas', async () => {
    mockIgpsport();
    let res = await connect({ email: 'yo@igp.test', password: 'mala' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /no ha aceptado/);
    res = await connect({ email: 'yo@igp.test' });
    assert.equal(res.status, 400);
    assert.equal((await status()).connected, false);
  });

  it('sincroniza: importa los .fit, los vincula y no vuelve a descargarlos', async () => {
    const rides = [
      { rideId: 3, title: 'Puerto de Navacerrada', fit: await buildFit({ segments: rideAt('2026-09-22T08:00:00Z') }) },
      { rideId: 2, title: 'Cycling', fit: await buildFit({ segments: rideAt('2026-09-21T08:00:00Z') }) },
      { rideId: 1, title: null, fit: await buildFit({ segments: rideAt('2026-09-20T08:00:00Z') }) },
    ];
    const calls = mockIgpsport({ rides });
    await connect();

    // Ya tenía la del día 21 (p. ej. de Strava): se vincula, no se duplica
    const userId = (await prisma.user.findFirst({ where: { email: 'igp@test.local' } })).id;
    await prisma.activity.create({
      data: { userId, title: 'De Strava', date: new Date('2026-09-21T08:00:10Z'), distanceKm: 5, durationMin: 10, source: 'strava' },
    });

    let res = await sync();
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.imported, 2);
    assert.equal(res.body.duplicates, 1);
    assert.equal(res.body.skipped, 0);
    assert.equal(res.body.hasMore, false);

    const activities = await prisma.activity.findMany({ orderBy: { date: 'desc' } });
    assert.equal(activities.length, 3);
    assert.deepEqual(await importedIds(), [['3'], ['2'], ['1']]);
    assert.equal(activities[0].title, 'Puerto de Navacerrada');
    assert.equal(activities[0].source, 'igpsport');
    assert.equal(activities[1].title, 'De Strava', 'la vinculada conserva sus datos');
    assert.equal(activities[2].title, 'Salida del 2026-09-20', 'sin título en iGPSPORT, el de la app');

    // Segunda sincronización: solo lista, no descarga nada
    const before = calls.length;
    res = await sync();
    assert.equal(res.body.imported, 0);
    assert.equal(res.body.alreadyImported, 3);
    const downloads = calls.slice(before).filter((c) => /Detail|\.fit$/.test(c.path));
    assert.equal(downloads.length, 0);
  });

  it('recorre todas las páginas del historial', async () => {
    const fit = await buildFit({ segments: rideAt('2026-09-01T08:00:00Z') });
    const rides = Array.from({ length: 25 }, (_, i) => ({ rideId: 100 + i, title: null, fit }));
    const calls = mockIgpsport({ rides });
    await connect();
    const res = await sync();
    // Todas empiezan a la misma hora: 1 importada y 24 enlazadas a ella
    assert.equal(res.body.imported + res.body.duplicates, 25);
    assert.equal(res.body.imported, 1);
    assert.deepEqual(calls.filter((c) => c.path.endsWith('queryMyActivity')).map((c) => c.query.pageNo), ['1', '2']);
  });

  it('una salida que no se puede importar no para el resto y se informa', async () => {
    const rides = [
      { rideId: 2, title: null, fit: await buildFit({ segments: rideAt('2026-09-21T08:00:00Z'), sport: 'running', subSport: 'street' }) },
      { rideId: 1, title: null, fit: await buildFit({ segments: rideAt('2026-09-20T08:00:00Z') }) },
    ];
    mockIgpsport({ rides, detailFails: [1] }); // la 1 se resuelve por getDownloadUrl
    await connect();
    const res = await sync();
    assert.equal(res.body.imported, 1);
    assert.equal(res.body.skipped, 1);
    assert.match(res.body.errors[0].error, /no es una salida en bici/);
  });

  it('sesión caducada en iGPSPORT: desconecta y pide volver a conectar (409)', async () => {
    mockIgpsport({ expired: true });
    await connect();
    const res = await sync();
    assert.equal(res.status, 409);
    assert.match(res.body.error, /caducado/);
    assert.equal((await status()).connected, false);
  });

  it('sin conectar, sincronizar responde 409; desconectar borra el token', async () => {
    mockIgpsport();
    assert.equal((await sync()).status, 409);
    await connect();
    assert.equal((await auth(request(app).delete('/api/connections/igpsport'))).status, 204);
    assert.equal(await connection(), null);
  });

  it('una cuenta de iGPSPORT ya conectada a otro usuario → 409', async () => {
    mockIgpsport();
    const own = token;
    token = await registerUser('otro@test.local');
    assert.equal((await connect()).status, 200);
    token = own;
    const res = await connect({ email: 'YO@igp.test', password: 'secreta' });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /otro usuario/);
  });

  it('sin TOKEN_ENCRYPTION_KEY no se ofrece (configured: false y 503)', async () => {
    const saved = process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    try {
      assert.equal((await status()).configured, false);
      assert.equal((await connect()).status, 503);
    } finally {
      process.env.TOKEN_ENCRYPTION_KEY = saved;
    }
  });

  it('iGPSPORT caído: 502 con mensaje claro', async () => {
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    const res = await connect();
    assert.equal(res.status, 502);
    assert.match(res.body.error, /No se puede conectar con iGPSPORT/);
  });

  it('requiere autenticación', async () => {
    assert.equal((await request(app).post('/api/connections/igpsport/connect')).status, 401);
  });
});
