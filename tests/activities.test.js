const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { app, prisma, request, resetDb, registerUser } = require('./helpers/utils');

const VALID = {
  title: ' Puertos de Madrid ',
  date: '2026-09-20T08:00:00Z',
  distanceKm: 85.4,
  durationMin: 210,
  avgHr: 138,
  maxHr: 176,
  elevationGain: 1650,
  notes: 'Navacerrada + Cotos',
};

// Cliente autenticado para un usuario
function client(token) {
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  return {
    list: (query = '') => auth(request(app).get(`/api/activities${query}`)),
    get: (id) => auth(request(app).get(`/api/activities/${id}`)),
    create: (body) => auth(request(app).post('/api/activities')).send(body),
    update: (id, body) => auth(request(app).patch(`/api/activities/${id}`)).send(body),
    remove: (id) => auth(request(app).delete(`/api/activities/${id}`)),
  };
}

describe('Activities', () => {
  let alice;
  let bob;

  beforeEach(async () => {
    await resetDb();
    alice = client(await registerUser('alice@test.local'));
    bob = client(await registerUser('bob@test.local'));
  });
  after(() => prisma.$disconnect());

  it('todas las rutas exigen autenticación', async () => {
    const checks = [
      request(app).get('/api/activities'),
      request(app).post('/api/activities').send(VALID),
      request(app).get('/api/activities/1'),
      request(app).patch('/api/activities/1').send({ title: 'x' }),
      request(app).delete('/api/activities/1'),
    ];
    for (const res of await Promise.all(checks)) assert.equal(res.status, 401);
  });

  describe('POST /api/activities', () => {
    it('crea una actividad completa', async () => {
      const res = await alice.create(VALID);
      assert.equal(res.status, 201);
      assert.equal(res.body.title, 'Puertos de Madrid');
      assert.equal(res.body.distanceKm, 85.4);
      assert.equal(res.body.date, '2026-09-20T08:00:00.000Z');
    });

    it('crea una actividad solo con los campos obligatorios', async () => {
      const res = await alice.create({ title: 'Rodaje', date: '2026-09-22', distanceKm: 30, durationMin: 60 });
      assert.equal(res.status, 201);
      assert.equal(res.body.avgHr, null);
      assert.equal(res.body.notes, null);
    });

    it('convierte fechas con zona horaria a UTC', async () => {
      const res = await alice.create({ ...VALID, date: '2026-09-20T08:00:00+02:00' });
      assert.equal(res.body.date, '2026-09-20T06:00:00.000Z');
    });

    it('acepta el 29 de febrero en año bisiesto', async () => {
      assert.equal((await alice.create({ ...VALID, date: '2024-02-29' })).status, 201);
    });

    const invalid = [
      ['falta title', { ...VALID, title: undefined }],
      ['title vacío', { ...VALID, title: '   ' }],
      ['title null', { ...VALID, title: null }],
      ['falta date', { ...VALID, date: undefined }],
      ['avgHr < 40', { ...VALID, avgHr: 39 }],
      ['maxHr > 220', { ...VALID, maxHr: 221 }],
      ['avgHr > maxHr', { ...VALID, avgHr: 180, maxHr: 170 }],
      ['FC decimal', { ...VALID, avgHr: 140.5 }],
      ['duración 0', { ...VALID, durationMin: 0 }],
      ['duración decimal', { ...VALID, durationMin: 10.5 }],
      ['distancia 0', { ...VALID, distanceKm: 0 }],
      ['distancia negativa', { ...VALID, distanceKm: -5 }],
      ['distancia como string', { ...VALID, distanceKm: '40' }],
      ['desnivel negativo', { ...VALID, elevationGain: -1 }],
      ['fecha inexistente', { ...VALID, date: '2026-13-45' }],
      ['31 de febrero', { ...VALID, date: '2026-02-31' }],
      ['29 feb no bisiesto', { ...VALID, date: '2026-02-29' }],
      ['fecha en texto libre', { ...VALID, date: 'September 20 2026' }],
      ['fecha futura', { ...VALID, date: '2099-01-01' }],
      ['campo no permitido', { ...VALID, userId: 999 }],
      ['body no es objeto', [VALID]],
    ];
    for (const [name, body] of invalid) {
      it(`${name} → 400`, async () => {
        const res = await alice.create(body);
        assert.equal(res.status, 400, JSON.stringify(res.body));
        assert.equal(typeof res.body.error, 'string');
      });
    }
  });

  describe('GET /api/activities', () => {
    beforeEach(async () => {
      await alice.create({ ...VALID, title: 'Septiembre', date: '2026-09-20T08:00:00Z' });
      await alice.create({ ...VALID, title: 'Enero', date: '2026-01-15T08:00:00Z' });
      await alice.create({ ...VALID, title: 'Nochevieja', date: '2025-12-31T18:30:00Z' });
    });

    it('lista solo las del usuario, ordenadas por fecha descendente', async () => {
      const res = await alice.list();
      assert.equal(res.status, 200);
      assert.equal(res.body.total, 3);
      assert.deepEqual(res.body.data.map((a) => a.title), ['Septiembre', 'Enero', 'Nochevieja']);

      const other = await bob.list();
      assert.equal(other.body.total, 0);
    });

    it('filtra por from', async () => {
      const res = await alice.list('?from=2026-01-01');
      assert.equal(res.body.total, 2);
    });

    it('"to" con solo fecha incluye el día completo', async () => {
      const res = await alice.list('?from=2025-12-31&to=2025-12-31');
      assert.deepEqual(res.body.data.map((a) => a.title), ['Nochevieja']);
    });

    it('pagina con limit y offset', async () => {
      const res = await alice.list('?limit=1&offset=1');
      assert.equal(res.body.total, 3);
      assert.equal(res.body.limit, 1);
      assert.equal(res.body.offset, 1);
      assert.deepEqual(res.body.data.map((a) => a.title), ['Enero']);
    });

    const invalid = ['?limit=0', '?limit=500', '?offset=-1', '?from=ayer', '?from=2026-09-01&to=2026-01-01'];
    for (const query of invalid) {
      it(`${query} → 400`, async () => {
        assert.equal((await alice.list(query)).status, 400);
      });
    }
  });

  describe('GET/PATCH/DELETE /api/activities/:id', () => {
    let id;
    beforeEach(async () => {
      id = (await alice.create(VALID)).body.id;
    });

    it('obtiene una actividad propia', async () => {
      const res = await alice.get(id);
      assert.equal(res.status, 200);
      assert.equal(res.body.id, id);
    });

    it('id no numérico → 400, inexistente → 404', async () => {
      assert.equal((await alice.get('abc')).status, 400);
      assert.equal((await alice.get(99999)).status, 404);
    });

    it('actualiza solo los campos enviados', async () => {
      const res = await alice.update(id, { title: 'Nuevo título' });
      assert.equal(res.status, 200);
      assert.equal(res.body.title, 'Nuevo título');
      assert.equal(res.body.distanceKm, VALID.distanceKm);
    });

    it('null borra un campo opcional', async () => {
      const res = await alice.update(id, { notes: null, avgHr: null });
      assert.equal(res.status, 200);
      assert.equal(res.body.notes, null);
      assert.equal(res.body.avgHr, null);
    });

    it('valida la FC media contra la máxima ya guardada', async () => {
      const res = await alice.update(id, { avgHr: 190 });
      assert.equal(res.status, 400);
    });

    it('PATCH sin campos → 400', async () => {
      assert.equal((await alice.update(id, {})).status, 400);
    });

    it('borra una actividad propia', async () => {
      assert.equal((await alice.remove(id)).status, 204);
      assert.equal((await alice.get(id)).status, 404);
    });

    it('otro usuario no puede ver, editar ni borrar la actividad (404)', async () => {
      assert.equal((await bob.get(id)).status, 404);
      assert.equal((await bob.update(id, { title: 'hack' })).status, 404);
      assert.equal((await bob.remove(id)).status, 404);

      const res = await alice.get(id);
      assert.equal(res.body.title, 'Puertos de Madrid');
    });
  });
});
