const { describe, it, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { app, prisma, request, resetDb, registerUser } = require('./helpers/utils');
const { parseGpx } = require('../src/services/gpx.service');

const realFetch = globalThis.fetch;
const brouterCalls = [];
// BRouter simulado: recta hacia el norte con 3 puntos y subida de 10 m
function mockBrouter(handler) {
  brouterCalls.length = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname !== 'brouter.de') return realFetch(input, init);
    brouterCalls.push(url);
    return handler(url);
  };
}
const geojson = (coords, meters) => new Response(JSON.stringify({
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: { 'track-length': String(meters) }, geometry: { type: 'LineString', coordinates: coords } }],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

// Ruta de 13 puntos hacia el norte (≈ 133 m): llano, sube 40 m (5 m por punto) y termina en llano
const GEOMETRY = Array.from({ length: 13 }, (_, i) => [
  Math.round((40 + i * 0.0001) * 1e4) / 1e4, -3, Math.min(Math.max(600 + (i - 2) * 5, 600), 640),
]);
const ROUTE = { name: 'Vuelta al "Pantano" & más', routing: 'road', waypoints: [[40, -3], [40.001, -3]], geometry: GEOMETRY };

describe('Rutas planificadas', () => {
  let token;
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);

  beforeEach(async () => {
    await resetDb();
    await prisma.plannedRoute.deleteMany();
    token = await registerUser('planner@test.local');
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  after(() => prisma.$disconnect());

  describe('GET /api/planned-routes/leg', () => {
    const leg = (query) => auth(request(app).get('/api/planned-routes/leg').query(query));

    it('pide el tramo a BRouter con el perfil ciclista y devuelve lat, lon, altitud', async () => {
      mockBrouter(() => geojson([[-3, 40, 600.25], [-3, 40.0005, 603], [-3, 40.001, 610]], 111.2));
      const res = await leg({ from: '40,-3', to: '40.001,-3', routing: 'gravel' });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body.coords[0], [40, -3, 600.3]);
      assert.equal(res.body.distanceKm, 0.11);
      assert.equal(brouterCalls[0].searchParams.get('profile'), 'gravel');
      assert.equal(brouterCalls[0].searchParams.get('lonlats'), '-3,40|-3,40.001');
    });

    it('carretera usa el perfil fastbike', async () => {
      mockBrouter(() => geojson([[-3, 40, 1], [-3, 40.001, 2]], 111));
      await leg({ from: '40,-3', to: '40.001,-3', routing: 'road' });
      assert.equal(brouterCalls[0].searchParams.get('profile'), 'fastbike');
    });

    it('sin camino posible → 422', async () => {
      mockBrouter(() => new Response('position not mapped in existing datafile', { status: 500 }));
      const res = await leg({ from: '40,-3', to: '39,-30', routing: 'road' });
      assert.equal(res.status, 422);
    });

    it('servicio caído → 502 con mensaje claro', async () => {
      mockBrouter(() => { throw new TypeError('fetch failed'); });
      const res = await leg({ from: '40,-3', to: '40.001,-3', routing: 'road' });
      assert.equal(res.status, 502);
      assert.match(res.body.error, /línea recta/);
    });

    const invalid = [
      ['coordenadas mal formadas', { from: '40', to: '40.001,-3', routing: 'road' }],
      ['latitud fuera de rango', { from: '95,-3', to: '40.001,-3', routing: 'road' }],
      ['perfil desconocido', { from: '40,-3', to: '40.001,-3', routing: 'coche' }],
    ];
    for (const [name, query] of invalid) {
      it(`${name} → 400`, async () => {
        mockBrouter(() => geojson([[-3, 40, 1], [-3, 40.001, 2]], 111));
        assert.equal((await leg(query)).status, 400);
        assert.equal(brouterCalls.length, 0);
      });
    }
  });

  describe('CRUD', () => {
    it('crea la ruta calculando distancia y desnivel en el servidor', async () => {
      const res = await auth(request(app).post('/api/planned-routes')).send(ROUTE);
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(res.body.distanceKm, 0.13);
      assert.equal(res.body.elevationGain, 40);
      assert.deepEqual(res.body.waypoints, ROUTE.waypoints);
      assert.equal(res.body.geometry.length, 13);
      assert.ok(res.body.preview[0].length >= 2);
    });

    it('?limit devuelve solo las más recientes', async () => {
      await auth(request(app).post('/api/planned-routes')).send({ ...ROUTE, name: 'Primera' });
      await auth(request(app).post('/api/planned-routes')).send({ ...ROUTE, name: 'Segunda' });
      const res = await auth(request(app).get('/api/planned-routes?limit=1'));
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.map((r) => r.name), ['Segunda']);
      assert.equal((await auth(request(app).get('/api/planned-routes?limit=0'))).status, 400);
    });

    it('rutas guardadas sin miniatura: se calcula al listar sin cambiar su orden', async () => {
      const { body: old } = await auth(request(app).post('/api/planned-routes')).send({ ...ROUTE, name: 'Antigua' });
      await auth(request(app).post('/api/planned-routes')).send({ ...ROUTE, name: 'Nueva' });
      await prisma.$executeRaw`UPDATE "PlannedRoute" SET "preview" = NULL WHERE "id" = ${old.id}`;

      const list = await auth(request(app).get('/api/planned-routes'));
      assert.deepEqual(list.body.map((r) => r.name), ['Nueva', 'Antigua']);
      assert.ok(list.body[1].preview[0].length >= 2);
      const stored = await prisma.plannedRoute.findUnique({ where: { id: old.id } });
      assert.ok(stored.preview);
      assert.equal(stored.updatedAt.getTime(), new Date(old.updatedAt).getTime());
    });

    it('lista sin el trazado completo, actualiza y borra', async () => {
      const { body: created } = await auth(request(app).post('/api/planned-routes')).send(ROUTE);
      let list = await auth(request(app).get('/api/planned-routes'));
      assert.equal(list.body.length, 1);
      assert.equal(list.body[0].geometry, undefined);
      assert.equal(list.body[0].waypoints, undefined);

      const updated = await auth(request(app).put(`/api/planned-routes/${created.id}`))
        .send({ ...ROUTE, name: 'Nuevo nombre', routing: 'straight', geometry: [[40, -3], [40.001, -3]] });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.name, 'Nuevo nombre');
      assert.equal(updated.body.elevationGain, null); // sin altitud en línea recta

      assert.equal((await auth(request(app).delete(`/api/planned-routes/${created.id}`))).status, 204);
      list = await auth(request(app).get('/api/planned-routes'));
      assert.equal(list.body.length, 0);
    });

    it('otro usuario no puede ver, editar, exportar ni borrar la ruta', async () => {
      const { body: created } = await auth(request(app).post('/api/planned-routes')).send(ROUTE);
      const other = await registerUser('otro@test.local');
      const as = (req) => req.set('Authorization', `Bearer ${other}`);
      assert.equal((await as(request(app).get(`/api/planned-routes/${created.id}`))).status, 404);
      assert.equal((await as(request(app).put(`/api/planned-routes/${created.id}`)).send(ROUTE)).status, 404);
      assert.equal((await as(request(app).get(`/api/planned-routes/${created.id}/gpx`))).status, 404);
      assert.equal((await as(request(app).delete(`/api/planned-routes/${created.id}`))).status, 404);
      assert.equal((await as(request(app).get('/api/planned-routes'))).body.length, 0);
    });

    const invalid = [
      ['sin nombre', { ...ROUTE, name: '  ' }],
      ['routing desconocido', { ...ROUTE, routing: 'coche' }],
      ['un solo waypoint', { ...ROUTE, waypoints: [[40, -3]] }],
      ['waypoint fuera de rango', { ...ROUTE, waypoints: [[40, -3], [91, -3]] }],
      ['geometría con texto', { ...ROUTE, geometry: [[40, -3, 'alto'], [40.1, -3, 1]] }],
      ['geometría vacía', { ...ROUTE, geometry: [] }],
    ];
    for (const [name, body] of invalid) {
      it(`${name} → 400`, async () => {
        assert.equal((await auth(request(app).post('/api/planned-routes')).send(body)).status, 400);
      });
    }
  });

  describe('GET /api/planned-routes/:id/gpx', () => {
    it('descarga un GPX válido con el recorrido, la altitud y el nombre escapado', async () => {
      const { body: created } = await auth(request(app).post('/api/planned-routes')).send(ROUTE);
      const res = await auth(request(app).get(`/api/planned-routes/${created.id}/gpx`)).buffer(true).parse((r, cb) => {
        let data = '';
        r.on('data', (c) => { data += c; });
        r.on('end', () => cb(null, data));
      });
      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], /application\/gpx\+xml/);
      assert.equal(res.headers['content-disposition'], 'attachment; filename="vuelta-al-pantano-mas.gpx"');
      assert.match(res.body, /<name>Vuelta al &quot;Pantano&quot; &amp; más<\/name>/);

      // El GPX exportado se puede volver a leer y conserva el recorrido
      const parsed = parseGpx(Buffer.from(res.body));
      assert.equal(parsed.name, 'Vuelta al "Pantano" & más');
      assert.equal(parsed.segments[0].length, 13);
      const last = parsed.segments[0][12];
      assert.deepEqual([last.lat, last.lon, last.ele], [40.0012, -3, 640]);
    });
  });
});

describe('Rutas planificadas: importación', () => {
  const { straightSegment, buildGpx } = require('./helpers/gpx');
  let token;
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);

  beforeEach(async () => {
    await resetDb();
    token = await registerUser('import@test.local');
  });

  it('un GPX sin marcas de tiempo (p. ej. de Komoot) se importa como ruta', async () => {
    // 200 puntos hacia el norte ≈ 22 km, sin <time>
    const segment = straightSegment({ n: 200, start: new Date(), ele: (i) => 600 + i }).map((p) => ({ ...p, time: null }));
    const res = await auth(request(app).post('/api/planned-routes/import-gpx'))
      .attach('file', buildGpx({ name: 'Ruta de Komoot', segments: [segment] }), 'komoot.gpx');
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.name, 'Ruta de Komoot');
    assert.equal(res.body.routing, 'road');
    assert.equal(res.body.distanceKm, 22.13);
    assert.equal(res.body.geometry.length, 200);
    // Puntos de paso cada 5 km: inicio, 4 intermedios y final
    assert.equal(res.body.waypoints.length, 6);
    assert.deepEqual(res.body.waypoints[0], [40, -3]);
  });

  it('sin nombre en el GPX usa el nombre del archivo', async () => {
    const segment = straightSegment({ n: 10, start: new Date() });
    const res = await auth(request(app).post('/api/planned-routes/import-gpx'))
      .attach('file', buildGpx({ name: null, segments: [segment] }), 'Sierra Norte.gpx');
    assert.equal(res.body.name, 'Sierra Norte');
  });

  it('archivo no GPX → 400', async () => {
    const res = await auth(request(app).post('/api/planned-routes/import-gpx')).attach('file', Buffer.from('<kml/>'), 'ruta.gpx');
    assert.equal(res.status, 400);
  });

  it('"Repetir esta salida" crea una ruta con el track de la salida', async () => {
    const ride = straightSegment({ n: 50, start: new Date('2026-09-20T08:00:00Z'), ele: () => 700 });
    const upload = await auth(request(app).post('/api/activities/upload-gpx'))
      .attach('file', buildGpx({ name: 'Vuelta del domingo', segments: [ride] }), 'ride.gpx');
    const res = await auth(request(app).post(`/api/planned-routes/from-activity/${upload.body.id}`));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.name, 'Vuelta del domingo');
    assert.equal(res.body.geometry.length, 50);
    assert.deepEqual(res.body.geometry[0], [40, -3, 700]);
    assert.equal(res.body.distanceKm, upload.body.distanceKm);
  });

  it('"Repetir" una salida manual sin GPS → 400; ajena → 404', async () => {
    const manual = await auth(request(app).post('/api/activities'))
      .send({ title: 'Manual', date: '2026-09-20', distanceKm: 20, durationMin: 60 });
    assert.equal((await auth(request(app).post(`/api/planned-routes/from-activity/${manual.body.id}`))).status, 400);

    const other = await registerUser('otro2@test.local');
    const res = await request(app).post(`/api/planned-routes/from-activity/${manual.body.id}`).set('Authorization', `Bearer ${other}`);
    assert.equal(res.status, 404);
  });
});
