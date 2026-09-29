const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { app, prisma, request, resetDb, registerUser } = require('./helpers/utils');
const { straightSegment, buildGpx } = require('./helpers/gpx');
const { computeStats, parseGpx, haversine } = require('../src/services/gpx.service');

const START = new Date('2026-09-20T08:00:00Z');
const STEP_M = 111.195; // metros entre puntos consecutivos

// Rampa: llano a 600 m, sube 2 m por punto hasta 700 m y sigue llano
const ramp = (i) => (i < 10 ? 600 : Math.min(600 + (i - 10) * 2, 700));
// FC: 120/130/140 en ciclo y una lectura absurda (250) que debe descartarse
const heart = (i) => (i === 50 ? 250 : 120 + (i % 3) * 10);

// Salida de referencia: 101 puntos cada 20 s (≈ 20 km/h) + 10 min parado + 11 puntos más
function referenceRide() {
  const first = straightSegment({ n: 101, start: START, ele: ramp, hr: heart });
  const secondStart = new Date(START.getTime() + (100 * 20 + 600) * 1000);
  const second = straightSegment({ n: 11, start: secondStart, lat0: 40.1, ele: () => 700, hr: () => 130 });
  return [first, second];
}

describe('GPX: cálculos', () => {
  it('haversine: 0,001° de latitud ≈ 111,195 m', () => {
    const d = haversine({ lat: 40, lon: -3 }, { lat: 40.001, lon: -3 });
    assert.ok(Math.abs(d - STEP_M) < 0.01, `distancia ${d}`);
  });

  it('calcula distancia, tiempo en movimiento, desnivel y FC', () => {
    const stats = computeStats(parseGpx(buildGpx({ segments: referenceRide() })).segments);
    assert.equal(stats.distanceKm, 12.23); // 110 tramos × 111,195 m
    assert.equal(stats.durationMin, 37); // 2200 s en movimiento; la pausa entre segmentos no cuenta
    assert.ok(stats.elevationGain >= 98 && stats.elevationGain <= 100, `desnivel ${stats.elevationGain}`);
    assert.equal(stats.maxHr, 140); // el 250 se descarta como artefacto
    assert.equal(stats.avgHr, 130);
    assert.equal(stats.startTime.toISOString(), START.toISOString());
  });

  it('no cuenta como movimiento el tiempo parado dentro de un segmento', () => {
    const moving = straightSegment({ n: 31, start: START }); // 600 s en movimiento
    const last = moving.at(-1);
    const stopped = [1, 2, 3].map((k) => ({ ...last, time: new Date(last.time.getTime() + k * 100_000) }));
    const stats = computeStats([[...moving, ...stopped].map((p) => ({ ...p, time: p.time.getTime() }))]);
    assert.equal(stats.durationMin, 10);
  });

  it('el ruido de altitud del GPS en llano no suma desnivel', () => {
    const noisy = straightSegment({ n: 200, start: START, ele: (i) => 600 + (i % 2 ? 1.5 : -1.5) });
    const stats = computeStats(parseGpx(buildGpx({ segments: [noisy] })).segments);
    assert.equal(stats.elevationGain, 0); // sumando las subidas brutas saldrían ~300 m
  });

  it('sin datos de pulso deja la FC a null', () => {
    const stats = computeStats(parseGpx(buildGpx({ segments: [straightSegment({ n: 10, start: START })] })).segments);
    assert.equal(stats.avgHr, null);
    assert.equal(stats.maxHr, null);
  });
});

describe('POST /api/activities/upload-gpx', () => {
  let token;
  const upload = (buffer, filename = 'ruta.gpx', fields = {}) => {
    const req = request(app).post('/api/activities/upload-gpx').set('Authorization', `Bearer ${token}`);
    for (const [k, v] of Object.entries(fields)) req.field(k, v);
    return buffer ? req.attach('file', buffer, filename) : req;
  };

  beforeEach(async () => {
    await resetDb();
    token = await registerUser('gpx@test.local');
  });
  after(() => prisma.$disconnect());

  it('crea la actividad con los datos calculados y la miniatura del recorrido', async () => {
    const res = await upload(buildGpx({ name: 'Vuelta al pantano', segments: referenceRide() }));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const a = res.body;
    assert.equal(a.title, 'Vuelta al pantano');
    assert.equal(a.source, 'gpx');
    assert.equal(a.date, START.toISOString());
    assert.equal(a.distanceKm, 12.23);
    assert.equal(a.durationMin, 37);
    assert.equal(a.avgHr, 130);
    assert.equal(a.maxHr, 140);
    assert.ok(Array.isArray(a.routePreview) && a.routePreview.length === 2);
    assert.deepEqual(a.routePreview[0][0], [40, -3]);
    assert.equal(a.track, undefined);
  });

  it('el campo "title" sustituye al nombre del GPX; sin nombre usa la fecha', async () => {
    const segments = [straightSegment({ n: 20, start: START })];
    let res = await upload(buildGpx({ segments }), 'ruta.gpx', { title: 'Mi título' });
    assert.equal(res.body.title, 'Mi título');
    res = await upload(buildGpx({ name: null, segments: [straightSegment({ n: 20, start: new Date(START.getTime() + 3600e3) })] }));
    assert.equal(res.body.title, 'Salida del 2026-09-20');
  });

  it('el mismo recorrido subido dos veces (misma hora) → 409 y no se duplica', async () => {
    const gpx = buildGpx({ name: 'Vuelta al pantano', segments: referenceRide() });
    assert.equal((await upload(gpx)).status, 201);
    const res = await upload(gpx, 'copia.gpx');
    assert.equal(res.status, 409);
    assert.match(res.body.error, /ya está registrada: «Vuelta al pantano»/);
    assert.equal(await prisma.activity.count(), 1);
  });

  it('GET /:id/track devuelve los puntos para el mapa', async () => {
    const { body: activity } = await upload(buildGpx({ segments: referenceRide() }));
    const res = await request(app).get(`/api/activities/${activity.id}/track`).set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.pointCount, 112);
    assert.deepEqual(res.body.pointFormat, ['lat', 'lon', 'ele', 'secondsFromStart', 'hr']);
    assert.deepEqual(res.body.segments[0][0], [40, -3, 600, 0, 120]);
    assert.equal(res.body.segments[0][50][4], null); // FC absurda descartada
    assert.deepEqual(res.body.bounds, { minLat: 40, maxLat: 40.11, minLon: -3, maxLon: -3 });
  });

  it('el listado incluye routePreview y las estadísticas cuentan la salida', async () => {
    await upload(buildGpx({ segments: referenceRide() }));
    const list = await request(app).get('/api/activities').set('Authorization', `Bearer ${token}`);
    assert.equal(list.body.data[0].source, 'gpx');
    assert.ok(list.body.data[0].routePreview.length);

    const summary = await request(app).get('/api/stats/summary').set('Authorization', `Bearer ${token}`);
    assert.equal(summary.body.distanceKm, 12.23);
  });

  it('track de una actividad manual o ajena → 404', async () => {
    const manual = await request(app).post('/api/activities').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Manual', date: '2026-09-20', distanceKm: 10, durationMin: 30 });
    let res = await request(app).get(`/api/activities/${manual.body.id}/track`).set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 404);
    assert.equal(manual.body.routePreview, null);

    const { body: activity } = await upload(buildGpx({ segments: referenceRide() }));
    const other = await registerUser('otro@test.local');
    res = await request(app).get(`/api/activities/${activity.id}/track`).set('Authorization', `Bearer ${other}`);
    assert.equal(res.status, 404);
  });

  it('borrar la actividad borra también su track', async () => {
    const { body: activity } = await upload(buildGpx({ segments: referenceRide() }));
    await request(app).delete(`/api/activities/${activity.id}`).set('Authorization', `Bearer ${token}`);
    assert.equal(await prisma.activityTrack.count(), 0);
  });

  it('sin autenticación → 401', async () => {
    const res = await request(app).post('/api/activities/upload-gpx')
      .attach('file', buildGpx({ segments: referenceRide() }), 'ruta.gpx');
    assert.equal(res.status, 401);
  });

  const noTimes = straightSegment({ n: 10, start: START }).map((p) => ({ ...p, time: null }));
  const invalid = [
    ['sin archivo', null, 'ruta.gpx', 'Adjunta un archivo .gpx'],
    ['extensión incorrecta', Buffer.from('<gpx/>'), 'ruta.txt', 'Solo se admiten archivos .gpx'],
    ['XML roto', Buffer.from('<gpx><trk><trkseg><trkpt lat="1"'), 'ruta.gpx', 'no es un GPX válido'],
    ['XML que no es GPX', Buffer.from('<?xml version="1.0"?><kml/>'), 'ruta.gpx', 'no es un GPX válido'],
    ['con DOCTYPE/entidades', Buffer.from('<?xml version="1.0"?><!DOCTYPE g [<!ENTITY a "b">]><gpx/>'), 'ruta.gpx', 'declaraciones no permitidas'],
    ['sin puntos', buildGpx({ segments: [] }), 'ruta.gpx', 'al menos dos puntos'],
    ['sin marcas de tiempo', buildGpx({ segments: [noTimes] }), 'ruta.gpx', 'marcas de tiempo'],
    ['fecha futura', buildGpx({ segments: [straightSegment({ n: 10, start: new Date('2099-01-01') })] }), 'ruta.gpx', 'futuro'],
  ];
  for (const [name, buffer, filename, message] of invalid) {
    it(`${name} → 400`, async () => {
      const res = await upload(buffer, filename);
      assert.equal(res.status, 400);
      assert.match(res.body.error, new RegExp(message));
    });
  }

  it('archivo de más de 15 MB → 413', async () => {
    const res = await upload(Buffer.alloc(16 * 1024 * 1024, ' '));
    assert.equal(res.status, 413);
  });
});
