const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { app, prisma, request, resetDb, registerUser, PASSWORD } = require('./helpers/utils');

const register = (body) => request(app).post('/api/auth/register').send(body);
const login = (body) => request(app).post('/api/auth/login').send(body);
const me = (token) => {
  const req = request(app).get('/api/auth/me');
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('Auth', () => {
  beforeEach(resetDb);
  after(() => prisma.$disconnect());

  describe('POST /api/auth/register', () => {
    it('crea el usuario, normaliza el email y devuelve token', async () => {
      const res = await register({ email: '  Rider@Test.local ', password: PASSWORD });
      assert.equal(res.status, 201);
      assert.equal(res.body.user.email, 'rider@test.local');
      assert.ok(res.body.token);
      assert.equal(res.body.user.passwordHash, undefined);
    });

    it('guarda la contraseña hasheada con bcrypt', async () => {
      await register({ email: 'rider@test.local', password: PASSWORD });
      const user = await prisma.user.findUnique({ where: { email: 'rider@test.local' } });
      assert.notEqual(user.passwordHash, PASSWORD);
      assert.match(user.passwordHash, /^\$2b\$/);
    });

    it('email duplicado (sin distinguir mayúsculas) → 409', async () => {
      await register({ email: 'rider@test.local', password: PASSWORD });
      const res = await register({ email: 'RIDER@test.local', password: PASSWORD });
      assert.equal(res.status, 409);
    });

    const invalid = [
      ['faltan campos', {}],
      ['email no válido', { email: 'nope', password: PASSWORD }],
      ['contraseña corta', { email: 'a@b.co', password: '1234567' }],
      ['contraseña > 72 bytes', { email: 'a@b.co', password: 'ñ'.repeat(37) }],
      ['tipos incorrectos', { email: 123, password: true }],
    ];
    for (const [name, body] of invalid) {
      it(`${name} → 400`, async () => {
        const res = await register(body);
        assert.equal(res.status, 400);
        assert.equal(typeof res.body.error, 'string');
      });
    }
  });

  describe('POST /api/auth/login', () => {
    beforeEach(() => registerUser('rider@test.local'));

    it('credenciales correctas → 200 con token', async () => {
      const res = await login({ email: 'Rider@test.local', password: PASSWORD });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, 'rider@test.local');
      assert.ok(res.body.token);
    });

    it('contraseña incorrecta y email inexistente dan el mismo 401', async () => {
      const wrongPassword = await login({ email: 'rider@test.local', password: 'incorrecta' });
      const unknownEmail = await login({ email: 'otro@test.local', password: PASSWORD });
      assert.equal(wrongPassword.status, 401);
      assert.deepEqual(wrongPassword.body, unknownEmail.body);
    });

    it('contraseña vacía → 400', async () => {
      const res = await login({ email: 'rider@test.local', password: '' });
      assert.equal(res.status, 400);
    });
  });

  describe('authMiddleware (GET /api/auth/me)', () => {
    it('token válido → devuelve el usuario', async () => {
      const token = await registerUser('rider@test.local');
      const res = await me(token);
      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, 'rider@test.local');
    });

    it('sin token → 401', async () => {
      const res = await me();
      assert.equal(res.status, 401);
    });

    it('token con firma incorrecta → 401', async () => {
      const token = jwt.sign({ sub: '1' }, 'otro-secreto');
      assert.equal((await me(token)).status, 401);
    });

    it('token expirado → 401 "Token expirado"', async () => {
      const token = jwt.sign({ sub: '1' }, process.env.JWT_SECRET, { expiresIn: -10 });
      const res = await me(token);
      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'Token expirado');
    });

    it('token sin firma (alg=none) → 401', async () => {
      const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
      const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: '1' })}.`;
      assert.equal((await me(token)).status, 401);
    });

    it('token de un usuario borrado → 404', async () => {
      const token = await registerUser('rider@test.local');
      await resetDb();
      assert.equal((await me(token)).status, 404);

      const res = await request(app).patch('/api/auth/me').set('Authorization', `Bearer ${token}`).send({ maxHr: 180 });
      assert.equal(res.status, 404);
    });
  });
});
