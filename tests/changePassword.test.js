const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { app, prisma, request, resetDb, registerUser, PASSWORD } = require('./helpers/utils');
const { signToken } = require('../src/services/auth.service');

const change = (token, body) => request(app).put('/api/auth/me/password').set('Authorization', `Bearer ${token}`).send(body);
const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });
const me = (token) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

describe('Cambiar la contraseña desde el perfil', () => {
  let token;
  beforeEach(async () => {
    await resetDb();
    token = await registerUser('rider@test.local');
  });
  after(() => prisma.$disconnect());

  it('el perfil dice si hay contraseña, sin exponer el hash', async () => {
    const { body } = await me(token);
    assert.equal(body.user.hasPassword, true);
    assert.equal(body.user.passwordHash, undefined);
  });

  it('con la actual correcta cambia la contraseña y la sesión sigue abierta', async () => {
    const res = await change(token, { currentPassword: PASSWORD, newPassword: 'otra-clave-nueva' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.hasPassword, true);
    assert.equal((await login('rider@test.local', PASSWORD)).status, 401);
    assert.equal((await login('rider@test.local', 'otra-clave-nueva')).status, 200);
    assert.equal((await me(token)).status, 200);
  });

  it('contraseña actual incorrecta o ausente → 400 (no 401, que cerraría la sesión)', async () => {
    for (const body of [{ currentPassword: 'mal', newPassword: 'otra-clave-nueva' }, { newPassword: 'otra-clave-nueva' }]) {
      const res = await change(token, body);
      assert.equal(res.status, 400);
      assert.match(res.body.error, /actual no es correcta/);
    }
    assert.equal((await login('rider@test.local', PASSWORD)).status, 200);
  });

  it('contraseña nueva corta o ausente → 400', async () => {
    assert.equal((await change(token, { currentPassword: PASSWORD, newPassword: '1234' })).status, 400);
    assert.equal((await change(token, { currentPassword: PASSWORD })).status, 400);
  });

  it('sin sesión → 401', async () => {
    const res = await request(app).put('/api/auth/me/password').send({ currentPassword: PASSWORD, newPassword: 'otra-clave-nueva' });
    assert.equal(res.status, 401);
  });

  it('una cuenta de Google sin contraseña puede crear una sin dar la actual', async () => {
    const user = await prisma.user.create({ data: { email: 'google@test.local', googleId: 'g-1' } });
    const googleToken = signToken(user);
    assert.equal((await me(googleToken)).body.user.hasPassword, false);
    const res = await change(googleToken, { newPassword: 'clave-de-google' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.hasPassword, true);
    assert.equal((await login('google@test.local', 'clave-de-google')).status, 200);
  });
});
