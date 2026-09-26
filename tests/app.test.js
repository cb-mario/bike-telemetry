const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');

const { app, prisma, request } = require('./helpers/utils');

describe('App', () => {
  after(() => prisma.$disconnect());

  it('GET /api/health responde ok', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('GET /api/health/db consulta la base de datos', async () => {
    const res = await request(app).get('/api/health/db');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('ruta inexistente → 404 con formato de error uniforme', async () => {
    const res = await request(app).get('/api/nope');
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Ruta no encontrada: GET /api/nope' });
  });

  it('JSON mal formado → 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bad');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'JSON mal formado');
  });

  it('cuerpo JSON de más de 100 kB fuera de las rutas planificadas → 413', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.es', password: 'x'.repeat(200 * 1024) });
    assert.equal(res.status, 413);
    assert.equal(res.body.error, 'La petición es demasiado grande');
  });

  it('CORS solo admite el frontend configurado y hay cabeceras de seguridad', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://evil.test');
    assert.equal(res.headers['access-control-allow-origin'], process.env.FRONTEND_URL);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  });
});
