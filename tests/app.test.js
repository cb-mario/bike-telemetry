const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { app, request } = require('./helpers/utils');

describe('App', () => {
  it('GET /api/health responde ok', async () => {
    const res = await request(app).get('/api/health');
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
});
