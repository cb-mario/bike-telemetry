const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const { authLimiters } = require('../src/middlewares/rateLimit');
const { errorHandler } = require('../src/middlewares/errorHandler');

// La app real los desactiva en los tests; aquí se prueban sobre una app mínima
function appWith(route, status) {
  const app = express();
  app.post('/', authLimiters()[route], (req, res) => res.status(status).json({}));
  app.use(errorHandler);
  return app;
}

describe('Límite de intentos en el acceso', () => {
  it('login: tras 10 intentos fallidos responde 429 con { error }', async () => {
    const app = appWith('login', 401);
    for (let i = 0; i < 10; i++) assert.equal((await request(app).post('/')).status, 401);
    const res = await request(app).post('/');
    assert.equal(res.status, 429);
    assert.match(res.body.error, /Demasiados intentos/);
  });

  it('login: los inicios de sesión correctos no gastan intentos', async () => {
    const app = appWith('login', 200);
    for (let i = 0; i < 15; i++) assert.equal((await request(app).post('/')).status, 200);
  });

  it('register: como mucho 10 altas por hora', async () => {
    const app = appWith('register', 201);
    for (let i = 0; i < 10; i++) assert.equal((await request(app).post('/')).status, 201);
    assert.equal((await request(app).post('/')).status, 429);
  });
});
