const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { app, prisma, request, resetDb, registerUser } = require('./helpers/utils');
const { straightSegment, buildGpx } = require('./helpers/gpx');
const polyline = require('../src/utils/polyline');

describe('Filtros, rutas para el mapa y polilíneas', () => {
  let token;
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  const create = (body) => auth(request(app).post('/api/activities')).send({ date: '2026-09-20', durationMin: 60, ...body });
  const list = (query) => auth(request(app).get(`/api/activities${query}`));

  beforeEach(async () => {
    await resetDb();
    token = await registerUser('rider@test.local');
    await create({ title: 'Subida a Navacerrada', distanceKm: 80, elevationGain: 1500, sportType: 'Ride' });
    await create({ title: 'Gravel por el pantano', distanceKm: 45, elevationGain: 400, sportType: 'GravelRide' });
    await create({ title: 'Rodaje llano', distanceKm: 30, elevationGain: 50 });
  });
  after(() => prisma.$disconnect());

  const titles = (res) => res.body.data.map((a) => a.title).sort();

  it('busca por título sin distinguir mayúsculas', async () => {
    assert.deepEqual(titles(await list('?q=navacerrada')), ['Subida a Navacerrada']);
  });

  it('filtra por distancia, desnivel y tipo', async () => {
    assert.deepEqual(titles(await list('?minKm=40')), ['Gravel por el pantano', 'Subida a Navacerrada']);
    assert.deepEqual(titles(await list('?maxKm=40')), ['Rodaje llano']);
    assert.deepEqual(titles(await list('?minElevation=300&maxElevation=1000')), ['Gravel por el pantano']);
    assert.deepEqual(titles(await list('?sportType=GravelRide')), ['Gravel por el pantano']);
  });

  const invalid = ['?minKm=-1', '?minKm=50&maxKm=10', '?sportType=Run', '?minElevation=abc'];
  for (const query of invalid) {
    it(`${query} → 400`, async () => {
      assert.equal((await list(query)).status, 400);
    });
  }

  it('GET /api/activities/routes devuelve solo las salidas con recorrido', async () => {
    const gpx = buildGpx({ segments: [straightSegment({ n: 30, start: new Date('2026-09-21T08:00:00Z') })] });
    const upload = await auth(request(app).post('/api/activities/upload-gpx')).attach('file', gpx, 'ruta.gpx');
    assert.equal(upload.status, 201);
    assert.ok(upload.body.maxSpeedKmh > 19.9 && upload.body.maxSpeedKmh < 20.1, `max ${upload.body.maxSpeedKmh}`);

    const res = await auth(request(app).get('/api/activities/routes'));
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, upload.body.id);
    assert.deepEqual(res.body[0].segments[0][0], [40, -3]);
    assert.equal(res.body[0].summaryPolyline, undefined);

    // ?limit acota el número de salidas; fuera de rango → 400
    assert.equal((await auth(request(app).get('/api/activities/routes?limit=1'))).body.length, 1);
    assert.equal((await auth(request(app).get('/api/activities/routes?limit=0'))).status, 400);

    // La polilínea guardada decodifica al mismo recorrido
    const stored = await prisma.activity.findUnique({ where: { id: upload.body.id } });
    const coords = polyline.decode(stored.summaryPolyline);
    assert.deepEqual(coords[0], [40, -3]);
    assert.deepEqual(coords.at(-1), [40.029, -3]);
  });

  it('polilínea: vector de ejemplo de Google en ambos sentidos', () => {
    const coords = [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]];
    assert.equal(polyline.encode(coords), '_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    assert.deepEqual(polyline.decode('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), coords);
  });
});
