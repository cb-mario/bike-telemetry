const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { app, prisma, request, resetDb, registerUser } = require('./helpers/utils');

// Cabeceras mínimas de cada formato (basta con los bytes mágicos)
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 2)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(32, 3)]);

const upload = (token, buffer, filename = 'foto.png') =>
  request(app).put('/api/auth/me/avatar').set('Authorization', `Bearer ${token}`).attach('file', buffer, filename);
const me = (token) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

describe('Foto de perfil', () => {
  let token;
  beforeEach(async () => {
    await resetDb();
    token = await registerUser('rider@test.local');
  });
  after(() => prisma.$disconnect());

  it('sin foto, avatarUrl es null', async () => {
    assert.equal((await me(token)).body.user.avatarUrl, null);
  });

  for (const [name, buffer, type] of [['PNG', PNG, 'image/png'], ['JPEG', JPEG, 'image/jpeg'], ['WebP', WEBP, 'image/webp']]) {
    it(`sube un ${name} y se sirve públicamente con su tipo y caché larga`, async () => {
      const res = await upload(token, buffer);
      assert.equal(res.status, 200);
      assert.match(res.body.user.avatarUrl, /^\/api\/avatars\/[0-9a-f-]{36}$/);

      const img = await request(app).get(res.body.user.avatarUrl).buffer(true);
      assert.equal(img.status, 200);
      assert.equal(img.headers['content-type'], type);
      assert.match(img.headers['cache-control'], /immutable/);
      assert.deepEqual(Buffer.from(img.body), buffer);
    });
  }

  it('el tipo sale de los bytes, no del nombre del archivo', async () => {
    const res = await upload(token, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'foto.png');
    assert.equal(res.status, 400);
    assert.match(res.body.error, /JPG, PNG o WebP/);
  });

  it('al cambiarla, la URL anterior deja de servir', async () => {
    const first = (await upload(token, PNG)).body.user.avatarUrl;
    const second = (await upload(token, JPEG)).body.user.avatarUrl;
    assert.notEqual(first, second);
    assert.equal((await request(app).get(first)).status, 404);
    assert.equal((await request(app).get(second)).status, 200);
    assert.equal(await prisma.userAvatar.count(), 1);
  });

  it('se puede quitar', async () => {
    const url = (await upload(token, PNG)).body.user.avatarUrl;
    const res = await request(app).delete('/api/auth/me/avatar').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.avatarUrl, null);
    assert.equal((await request(app).get(url)).status, 404);
  });

  it('más de 1 MB → 413; sin archivo → 400; sin sesión → 401', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(1024 * 1024)]);
    assert.equal((await upload(token, big)).status, 413);
    assert.equal((await request(app).put('/api/auth/me/avatar').set('Authorization', `Bearer ${token}`)).status, 400);
    assert.equal((await request(app).put('/api/auth/me/avatar').attach('file', PNG, 'foto.png')).status, 401);
  });
});
