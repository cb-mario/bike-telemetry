const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { app, prisma, request, resetDb, registerUser } = require('./helpers/utils');
const { straightSegment, buildGpx } = require('./helpers/gpx');
const { buildFit } = require('./helpers/fit');
const { sportTypeOf } = require('../src/services/fit.service');

const START = new Date('2026-09-20T08:00:00Z');

// Misma salida de referencia que en gpx.test.js: 101 puntos cada 20 s + 10 min parado + 11 puntos
function referenceRide() {
  const first = straightSegment({ n: 101, start: START, ele: (i) => (i < 10 ? 600 : Math.min(600 + (i - 10) * 2, 700)), hr: (i) => 120 + (i % 3) * 10 });
  const secondStart = new Date(START.getTime() + (100 * 20 + 600) * 1000);
  const second = straightSegment({ n: 11, start: secondStart, lat0: 40.1, ele: () => 700, hr: () => 130 });
  return [first, second];
}

describe('FIT: tipo de salida', () => {
  it('traduce deporte y subdeporte a los tipos de la app', () => {
    assert.equal(sportTypeOf('cycling', 'road'), 'Ride');
    assert.equal(sportTypeOf('cycling', 'generic'), 'Ride');
    assert.equal(sportTypeOf('cycling', 'gravelCycling'), 'GravelRide');
    assert.equal(sportTypeOf('cycling', 'mountain'), 'MountainBikeRide');
    assert.equal(sportTypeOf('cycling', 'indoorCycling'), 'VirtualRide');
    assert.equal(sportTypeOf('eBiking', 'generic'), 'EBikeRide');
    assert.equal(sportTypeOf('eBiking', 'eBikeMountain'), 'EMountainBikeRide');
  });
});

describe('POST /api/activities/import', () => {
  let token;
  const upload = (buffer, filename = 'salida.fit', fields = {}) => {
    const req = request(app).post('/api/activities/import').set('Authorization', `Bearer ${token}`);
    for (const [k, v] of Object.entries(fields)) req.field(k, v);
    return buffer ? req.attach('file', buffer, filename) : req;
  };

  beforeEach(async () => {
    await resetDb();
    token = await registerUser('fit@test.local');
  });
  after(() => prisma.$disconnect());

  it('sin sesión: calcula las métricas sobre el track, como con un GPX', async () => {
    const res = await upload(await buildFit({ segments: referenceRide(), session: null }));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const a = res.body;
    assert.equal(a.source, 'fit');
    assert.equal(a.sportType, 'Ride');
    assert.equal(a.distanceKm, 12.23);
    assert.equal(a.durationMin, 37);
    assert.ok(a.elevationGain >= 98 && a.elevationGain <= 100, `desnivel ${a.elevationGain}`);
    assert.equal(a.avgHr, 130);
    assert.equal(a.maxHr, 140);
    assert.equal(a.title, 'Salida del 2026-09-20');
    assert.equal(new Date(a.date).toISOString(), START.toISOString());
    assert.equal(a.routePreview.length, 2, 'la pausa de 10 min separa dos segmentos');

    const track = await request(app).get(`/api/activities/${a.id}/track`).set('Authorization', `Bearer ${token}`);
    assert.equal(track.status, 200);
    assert.equal(track.body.pointCount, 112);
    assert.deepEqual(track.body.segments[0][0].slice(0, 2), [40, -3]);
  });

  it('con sesión: mandan los totales del ciclocomputador y el tipo del FIT', async () => {
    const fit = await buildFit({
      segments: referenceRide(),
      subSport: 'gravelCycling',
      session: {
        totalDistance: 12500, totalTimerTime: 2400, totalMovingTime: 2280, totalAscent: 112,
        avgHeartRate: 128, maxHeartRate: 151, enhancedMaxSpeed: 12.5,
      },
    });
    const res = await upload(fit, 'salida.FIT', { title: 'Gravel por el pinar' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const a = res.body;
    assert.equal(a.title, 'Gravel por el pinar');
    assert.equal(a.sportType, 'GravelRide');
    assert.equal(a.distanceKm, 12.5);
    assert.equal(a.durationMin, 38);
    assert.equal(a.elevationGain, 112);
    assert.equal(a.avgHr, 128);
    assert.equal(a.maxHr, 151);
    assert.equal(a.maxSpeedKmh, 45);
  });

  it('rodillo sin GPS: crea la salida con los totales y sin recorrido', async () => {
    const fit = await buildFit({
      subSport: 'indoorCycling',
      session: { startTime: START, totalDistance: 30000, totalTimerTime: 3600, avgHeartRate: 140, maxHeartRate: 170 },
    });
    const res = await upload(fit);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.sportType, 'VirtualRide');
    assert.equal(res.body.distanceKm, 30);
    assert.equal(res.body.durationMin, 60);
    assert.equal(res.body.routePreview, null);

    const track = await request(app).get(`/api/activities/${res.body.id}/track`).set('Authorization', `Bearer ${token}`);
    assert.equal(track.status, 404);
  });

  it('también acepta GPX', async () => {
    const res = await upload(buildGpx({ name: 'Vuelta al pantano', segments: referenceRide() }), 'ruta.gpx');
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.source, 'gpx');
    assert.equal(res.body.title, 'Vuelta al pantano');
  });

  it('una salida ya guardada (por FIT, GPX u otra vía) devuelve 409 y no se duplica', async () => {
    const fit = await buildFit({ segments: referenceRide(), session: null });
    assert.equal((await upload(fit)).status, 201);

    const again = await upload(fit);
    assert.equal(again.status, 409);
    assert.match(again.body.error, /ya está registrada/);

    // La misma salida exportada en GPX (misma hora de inicio) también se reconoce
    const gpx = await upload(buildGpx({ segments: referenceRide() }), 'ruta.gpx');
    assert.equal(gpx.status, 409);

    assert.equal(await prisma.activity.count(), 1);
  });

  const invalid = [
    ['sin archivo', null, 'salida.fit', 400, 'Adjunta un archivo .gpx o .fit'],
    ['extensión incorrecta', Buffer.from('hola'), 'salida.txt', 400, 'Solo se admiten archivos .gpx o .fit'],
    ['binario que no es FIT', Buffer.from('esto no es un fit en absoluto'), 'salida.fit', 400, 'no es un FIT válido'],
  ];
  for (const [label, buffer, filename, status, message] of invalid) {
    it(`rechaza: ${label}`, async () => {
      const res = await upload(buffer, filename);
      assert.equal(res.status, status);
      assert.match(res.body.error, new RegExp(message));
    });
  }

  it('rechaza un FIT dañado', async () => {
    const fit = await buildFit({ segments: referenceRide(), session: null });
    fit[fit.length - 20] ^= 0xff; // cambia un byte: el CRC ya no cuadra
    const res = await upload(fit);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /dañado/);
  });

  it('rechaza actividades que no son de bici y archivos que no son actividades', async () => {
    let res = await upload(await buildFit({ segments: referenceRide(), sport: 'running', subSport: 'street' }));
    assert.equal(res.status, 400);
    assert.match(res.body.error, /no es una salida en bici/);

    res = await upload(await buildFit({ segments: referenceRide(), session: null, fileType: 'course' }));
    assert.equal(res.status, 400);
    assert.match(res.body.error, /no es una actividad grabada/);
  });

  it('requiere autenticación', async () => {
    const res = await request(app).post('/api/activities/import');
    assert.equal(res.status, 401);
  });
});
