const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { app, prisma, request, resetDb, registerUser, PASSWORD } = require('./helpers/utils');
const { testOutbox } = require('../src/services/mail.service');
const { signPurpose } = require('../src/utils/signedToken');

const forgot = (email) => request(app).post('/api/auth/forgot-password').send({ email });
const reset = (body) => request(app).post('/api/auth/reset-password').send(body);
const login = (password) => request(app).post('/api/auth/login').send({ email: 'rider@test.local', password });

// El envío no se espera en la petición: se da una vuelta al bucle para que llegue a la bandeja
const nextTick = () => new Promise((resolve) => setImmediate(resolve));

async function requestLink() {
  await forgot('Rider@Test.local');
  await nextTick();
  const mail = testOutbox.at(-1);
  return decodeURIComponent(mail.text.match(/#token=(\S+)/)[1]);
}

describe('Recuperación de contraseña', () => {
  beforeEach(async () => {
    await resetDb();
    testOutbox.length = 0;
    await registerUser('rider@test.local');
  });
  after(() => prisma.$disconnect());

  it('envía el enlace al email registrado', async () => {
    const res = await forgot('rider@test.local');
    await nextTick();
    assert.equal(res.status, 200);
    assert.equal(testOutbox.length, 1);
    assert.equal(testOutbox[0].to, 'rider@test.local');
    assert.match(testOutbox[0].text, /http:\/\/front\.test\/restablecer#token=/);
  });

  it('email sin cuenta: misma respuesta y ningún correo', async () => {
    const known = await forgot('rider@test.local');
    const unknown = await forgot('nadie@test.local');
    await nextTick();
    assert.equal(unknown.status, 200);
    assert.deepEqual(unknown.body, known.body);
    assert.equal(testOutbox.length, 1);
  });

  it('email no válido → 400', async () => {
    assert.equal((await forgot('nope')).status, 400);
    assert.equal((await request(app).post('/api/auth/forgot-password').send({})).status, 400);
  });

  it('cambia la contraseña, abre sesión y la anterior deja de servir', async () => {
    const token = await requestLink();
    const res = await reset({ token, password: 'otra-clave-nueva' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, 'rider@test.local');
    assert.equal((await login(PASSWORD)).status, 401);
    assert.equal((await login('otra-clave-nueva')).status, 200);
  });

  it('el enlace solo sirve una vez', async () => {
    const token = await requestLink();
    assert.equal((await reset({ token, password: 'otra-clave-nueva' })).status, 200);
    const again = await reset({ token, password: 'una-tercera-clave' });
    assert.equal(again.status, 400);
    assert.match(again.body.error, /no es válido o ha caducado/);
  });

  it('contraseña nueva demasiado corta → 400 sin gastar el enlace', async () => {
    const token = await requestLink();
    assert.equal((await reset({ token, password: '1234' })).status, 400);
    assert.equal((await reset({ token, password: 'otra-clave-nueva' })).status, 200);
  });

  it('no acepta tokens de otro propósito ni manipulados', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'rider@test.local' } });
    const session = (await login(PASSWORD)).body.token;
    const ticket = signPurpose('login-ticket', { sub: String(user.id) }, '2m');
    for (const token of [session, ticket, 'basura', `${await requestLink()}x`]) {
      assert.equal((await reset({ token, password: 'otra-clave-nueva' })).status, 400);
    }
  });

  it('una cuenta de Google sin contraseña puede ponerse una', async () => {
    await prisma.user.create({ data: { email: 'google@test.local', googleId: 'g-1' } });
    await forgot('google@test.local');
    await nextTick();
    const token = decodeURIComponent(testOutbox.at(-1).text.match(/#token=(\S+)/)[1]);
    assert.equal((await reset({ token, password: 'clave-de-google' })).status, 200);
    const res = await request(app).post('/api/auth/login').send({ email: 'google@test.local', password: 'clave-de-google' });
    assert.equal(res.status, 200);
  });
});
