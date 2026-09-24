const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { app, prisma, request, resetDb, registerUser } = require('./helpers/utils');

// Datos fijos con resultados calculados a mano
const RIDES = [
  { title: 'Lunes', date: '2026-09-21T10:00:00Z', distanceKm: 60, durationMin: 120, elevationGain: 800, avgHr: 140, maxHr: 175 },
  { title: 'Miércoles', date: '2026-09-23T10:00:00Z', distanceKm: 30, durationMin: 60, elevationGain: 200, avgHr: 120, maxHr: 150 },
  { title: 'Fondo', date: '2026-09-14T08:00:00Z', distanceKm: 100, durationMin: 240, elevationGain: 1500 },
  { title: 'Series', date: '2026-08-31T20:00:00Z', distanceKm: 40, durationMin: 90, avgHr: 165, maxHr: 185 },
];

function client(token) {
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  return {
    get: (path) => auth(request(app).get(`/api${path}`)),
    create: (body) => auth(request(app).post('/api/activities')).send(body),
    updateMe: (body) => auth(request(app).patch('/api/auth/me')).send(body),
  };
}

describe('Stats', () => {
  let alice;
  let bob;

  beforeEach(async () => {
    await resetDb();
    alice = client(await registerUser('alice@test.local'));
    bob = client(await registerUser('bob@test.local'));
    for (const ride of RIDES) {
      const res = await alice.create(ride);
      assert.equal(res.status, 201);
    }
  });
  after(() => prisma.$disconnect());

  it('todas las rutas exigen autenticación', async () => {
    for (const path of ['summary', 'evolution', 'hr-zones']) {
      assert.equal((await request(app).get(`/api/stats/${path}`)).status, 401);
    }
  });

  describe('GET /api/stats/summary', () => {
    it('calcula totales, medias y récords', async () => {
      const res = await alice.get('/stats/summary');
      assert.equal(res.status, 200);
      const s = res.body;
      assert.equal(s.count, 4);
      assert.equal(s.distanceKm, 230);
      assert.equal(s.durationMin, 510);
      assert.equal(s.elevationGain, 2500);
      assert.equal(s.avgSpeedKmh, 27.1); // 230 km / 8,5 h
      assert.equal(s.avgHr, 144); // (140·120 + 120·60 + 165·90) / 270, ponderada por duración
      assert.equal(s.avgDistanceKm, 57.5);
      assert.equal(s.avgDurationMin, 128);
      assert.equal(s.maxHr, 185);
      assert.equal(s.records.longestDistance.title, 'Fondo');
      assert.equal(s.records.longestDuration.title, 'Fondo');
      assert.equal(s.records.biggestClimb.elevationGain, 1500);
    });

    it('filtra por rango de fechas', async () => {
      const s = (await alice.get('/stats/summary?from=2026-09-15&to=2026-09-23')).body;
      assert.equal(s.count, 2);
      assert.equal(s.distanceKm, 90);
      assert.equal(s.avgSpeedKmh, 30);
      assert.equal(s.avgHr, 133);
    });

    it('sin actividades devuelve ceros y nulls', async () => {
      const s = (await bob.get('/stats/summary')).body;
      assert.equal(s.count, 0);
      assert.equal(s.distanceKm, 0);
      assert.equal(s.avgSpeedKmh, null);
      assert.equal(s.avgHr, null);
      assert.equal(s.maxHr, null);
      assert.deepEqual(s.records, { longestDistance: null, longestDuration: null, biggestClimb: null });
    });

    it('rango inválido → 400', async () => {
      assert.equal((await alice.get('/stats/summary?from=2026-09-30&to=2026-09-01')).status, 400);
    });
  });

  describe('GET /api/stats/evolution', () => {
    it('agrupa por semanas (lunes, UTC) e incluye las semanas vacías', async () => {
      const res = await alice.get('/stats/evolution?period=week&from=2026-08-31&to=2026-09-27');
      assert.equal(res.status, 200);
      const { buckets } = res.body;
      assert.deepEqual(buckets.map((b) => b.periodStart), ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21']);
      assert.deepEqual(buckets.map((b) => b.count), [1, 0, 1, 2]);
      assert.deepEqual(buckets.map((b) => b.distanceKm), [40, 0, 100, 90]);
      assert.equal(buckets[1].avgSpeedKmh, null);
      assert.equal(buckets[3].elevationGain, 1000);
    });

    it('una actividad del domingo por la noche cuenta en su semana', async () => {
      await alice.create({ title: 'Domingo', date: '2026-09-20T23:30:00Z', distanceKm: 10, durationMin: 30 });
      const { buckets } = (await alice.get('/stats/evolution?from=2026-09-14&to=2026-09-27')).body;
      assert.deepEqual(buckets.map((b) => b.count), [2, 2]);
    });

    it('agrupa por meses', async () => {
      const { buckets } = (await alice.get('/stats/evolution?period=month&from=2026-08-01&to=2026-09-30')).body;
      assert.deepEqual(buckets.map((b) => b.periodStart), ['2026-08-01', '2026-09-01']);
      assert.deepEqual(buckets.map((b) => b.count), [1, 3]);
    });

    it('por defecto devuelve las últimas 12 semanas consecutivas', async () => {
      const { period, buckets } = (await alice.get('/stats/evolution')).body;
      assert.equal(period, 'week');
      assert.equal(buckets.length, 12);
      for (let i = 1; i < buckets.length; i++) {
        const gapDays = (new Date(buckets[i].periodStart) - new Date(buckets[i - 1].periodStart)) / 86400000;
        assert.equal(gapDays, 7);
      }
      assert.ok(new Date(buckets.at(-1).periodStart) <= new Date());
    });

    it('period no válido → 400', async () => {
      assert.equal((await alice.get('/stats/evolution?period=day')).status, 400);
    });

    it('rango con demasiados periodos → 400', async () => {
      assert.equal((await alice.get('/stats/evolution?period=week&from=2000-01-01')).status, 400);
    });

    it('no mezcla datos de otros usuarios', async () => {
      const { buckets } = (await bob.get('/stats/evolution?from=2026-08-31&to=2026-09-27')).body;
      assert.ok(buckets.every((b) => b.count === 0));
    });
  });

  describe('GET /api/stats/hr-zones', () => {
    it('sin FC en el perfil usa la mayor registrada (185 bpm)', async () => {
      const z = (await alice.get('/stats/hr-zones')).body;
      assert.equal(z.maxHr, 185);
      assert.equal(z.maxHrSource, 'activities');
      assert.equal(z.activitiesWithHr, 3);
      assert.equal(z.activitiesWithoutHr, 1);
      assert.deepEqual(
        z.zones.map((zone) => [zone.minBpm, zone.maxBpm]),
        [[93, 110], [111, 129], [130, 147], [148, 166], [167, 185]],
      );
      // 120 bpm → Z2, 140 → Z3, 165 → Z4
      assert.deepEqual(z.zones.map((zone) => zone.count), [0, 1, 1, 1, 0]);
      assert.deepEqual(z.zones.map((zone) => zone.durationMin), [0, 60, 120, 90, 0]);
      assert.deepEqual(z.zones.map((zone) => zone.percentTime), [0, 22.2, 44.4, 33.3, 0]);
    });

    it('usa la FC máxima del perfil cuando existe', async () => {
      await alice.updateMe({ maxHr: 170 });
      const z = (await alice.get('/stats/hr-zones')).body;
      assert.equal(z.maxHr, 170);
      assert.equal(z.maxHrSource, 'profile');
      // Con 170: 120 → Z3, 140 → Z4, 165 → Z5
      assert.deepEqual(z.zones.map((zone) => zone.count), [0, 0, 1, 1, 1]);
    });

    it('FC por debajo de Z1 cuenta como Z1 y por encima de la máxima como Z5', async () => {
      await resetDb();
      const carol = client(await registerUser('carol@test.local'));
      await carol.updateMe({ maxHr: 170 });
      await carol.create({ title: 'Paseo', date: '2026-09-20', distanceKm: 10, durationMin: 40, avgHr: 60 });
      await carol.create({ title: 'Sprint', date: '2026-09-21', distanceKm: 5, durationMin: 10, avgHr: 180, maxHr: 195 });
      const z = (await carol.get('/stats/hr-zones')).body;
      assert.deepEqual(z.zones.map((zone) => zone.count), [1, 0, 0, 0, 1]);
    });

    it('filtra por rango de fechas', async () => {
      const z = (await alice.get('/stats/hr-zones?from=2026-09-15')).body;
      assert.equal(z.activitiesWithHr, 2);
    });

    it('sin datos de FC devuelve zones: null', async () => {
      const z = (await bob.get('/stats/hr-zones')).body;
      assert.equal(z.maxHr, null);
      assert.equal(z.maxHrSource, null);
      assert.equal(z.zones, null);
    });
  });

  describe('PATCH /api/auth/me (FC máxima del perfil)', () => {
    it('guarda y borra maxHr', async () => {
      let res = await alice.updateMe({ maxHr: 190 });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.maxHr, 190);
      assert.equal((await alice.get('/auth/me')).body.user.maxHr, 190);

      res = await alice.updateMe({ maxHr: null });
      assert.equal(res.body.user.maxHr, null);
    });

    const invalid = [
      ['maxHr < 100', { maxHr: 90 }],
      ['maxHr > 220', { maxHr: 230 }],
      ['maxHr decimal', { maxHr: 180.5 }],
      ['maxHr texto', { maxHr: '180' }],
      ['campo no permitido', { email: 'x@y.z' }],
      ['body vacío', {}],
    ];
    for (const [name, body] of invalid) {
      it(`${name} → 400`, async () => {
        assert.equal((await alice.updateMe(body)).status, 400);
      });
    }
  });
});
