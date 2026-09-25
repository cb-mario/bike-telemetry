const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { app, prisma, request, resetDb, registerUser } = require('./helpers/utils');
const statsService = require('../src/services/stats.service');

const MADRID = 'Europe/Madrid';

describe('Zona horaria del usuario', () => {
  let token;
  const get = (path, tz) => {
    const req = request(app).get(`/api${path}`).set('Authorization', `Bearer ${token}`);
    return tz ? req.set('X-Timezone', tz) : req;
  };
  const create = (body, tz = MADRID) => request(app).post('/api/activities')
    .set('Authorization', `Bearer ${token}`).set('X-Timezone', tz).send(body);
  const ride = (title, date) => ({ title, date, distanceKm: 20, durationMin: 60 });

  beforeEach(async () => {
    await resetDb();
    token = await registerUser('tz@test.local');
  });
  after(() => prisma.$disconnect());

  it('una salida a las 00:30 del 1 de septiembre en Madrid cuenta en septiembre', async () => {
    // 22:30 UTC del 31 de agosto = 00:30 del 1 de septiembre en Madrid (UTC+2)
    await create(ride('Madrugada', '2026-08-31T22:30:00Z'));
    const query = '/stats/evolution?period=month&from=2026-08-01&to=2026-09-30';

    const madrid = (await get(query, MADRID)).body.buckets;
    assert.deepEqual(madrid.map((b) => [b.periodStart, b.count]), [['2026-08-01', 0], ['2026-09-01', 1]]);
    const utc = (await get(query, 'UTC')).body.buckets;
    assert.deepEqual(utc.map((b) => [b.periodStart, b.count]), [['2026-08-01', 1], ['2026-09-01', 0]]);
  });

  it('las semanas empiezan el lunes a las 00:00 locales', async () => {
    // Domingo 20 de septiembre 22:30 UTC = lunes 21 a las 00:30 en Madrid
    await create(ride('Lunes temprano', '2026-09-20T22:30:00Z'));
    const res = await get('/stats/evolution?period=week&from=2026-09-14&to=2026-09-27', MADRID);
    assert.deepEqual(res.body.buckets.map((b) => [b.periodStart, b.count]), [['2026-09-14', 0], ['2026-09-21', 1]]);
  });

  it('from/to sin hora son días completos en la zona del usuario', async () => {
    await create(ride('Madrugada', '2026-08-31T22:30:00Z'));
    assert.equal((await get('/stats/summary?from=2026-09-01', MADRID)).body.count, 1);
    assert.equal((await get('/stats/summary?to=2026-08-31', MADRID)).body.count, 0);
    assert.equal((await get('/activities?from=2026-09-01&to=2026-09-01', MADRID)).body.total, 1);
  });

  it('una fecha manual sin hora es el comienzo de ese día en la zona del usuario', async () => {
    const res = await create(ride('Manual', '2026-09-24'));
    assert.equal(res.status, 201);
    assert.equal(res.body.date, '2026-09-23T22:00:00.000Z');
  });

  it('una zona horaria no válida no rompe la petición: se usa la de la app', async () => {
    await create(ride('Madrugada', '2026-08-31T22:30:00Z'));
    const res = await get('/stats/summary?from=2026-09-01', 'Marte/Olympus');
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 0); // APP_TIMEZONE=UTC en los tests
  });

  describe('overview: historial, mes en curso y mismo tramo del mes anterior', () => {
    it('GET /api/stats/overview devuelve los tres resúmenes', async () => {
      const res = await get('/stats/overview', MADRID);
      assert.equal(res.status, 200);
      for (const key of ['total', 'month', 'prevMonth']) assert.equal(res.body[key].count, 0);
      assert.match(res.body.monthStart, /^\d{4}-\d{2}-01$/);
      assert.equal((await request(app).get('/api/stats/overview')).status, 401);
    });

    it('compara con el mes anterior solo hasta el mismo día', async () => {
      await create(ride('Este mes', '2026-09-03T08:00:00Z'));
      await create(ride('Agosto, antes del 25', '2026-08-10T08:00:00Z'));
      await create(ride('Agosto, después del 25', '2026-08-28T08:00:00Z'));
      // 00:30 del 1 de septiembre en Madrid: es de septiembre
      await create(ride('Medianoche', '2026-08-31T22:30:00Z'));
      const { id } = await prisma.user.findUnique({ where: { email: 'tz@test.local' } });

      const o = await statsService.overview(id, { timeZone: MADRID, now: new Date('2026-09-25T10:00:00Z') });
      assert.equal(o.total.count, 4);
      assert.equal(o.month.count, 2);
      assert.equal(o.prevMonth.count, 1);
      assert.equal(o.monthStart, '2026-09-01');
      assert.equal(o.prevMonthStart, '2026-08-01');
    });

    it('si el mes anterior es más corto, el tramo acaba en su último día', async () => {
      await create(ride('28 de febrero', '2026-02-28T20:00:00Z'));
      const { id } = await prisma.user.findUnique({ where: { email: 'tz@test.local' } });
      const o = await statsService.overview(id, { timeZone: MADRID, now: new Date('2026-03-31T10:00:00Z') });
      assert.equal(o.prevMonth.count, 1);
      assert.equal(o.prevMonthStart, '2026-02-01');
    });
  });
});
