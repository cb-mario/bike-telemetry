const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { app, prisma, request, resetDb, PASSWORD } = require('./helpers/utils');

// Fecha de nacimiento para tener exactamente `age` años hoy (el cumpleaños fue ayer)
function birthDateForAge(age) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - age);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const PROFILE = {
  name: '  Laura   Pérez ', birthDate: birthDateForAge(40), sex: 'female',
  heightCm: 168, weightKg: 61.25, restingHr: 52,
};

describe('Perfil de usuario', () => {
  beforeEach(resetDb);
  after(() => prisma.$disconnect());

  const register = (body) => request(app).post('/api/auth/register').send({ email: 'laura@test.local', password: PASSWORD, ...body });

  it('el registro por pasos guarda el perfil y devuelve estimaciones', async () => {
    const res = await register(PROFILE);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const { user } = res.body;
    assert.equal(user.name, 'Laura Pérez'); // espacios normalizados
    assert.equal(user.sex, 'female');
    assert.equal(user.heightCm, 168);
    assert.equal(user.weightKg, 61.3);
    assert.equal(user.restingHr, 52);
    assert.equal(user.passwordHash, undefined);
    assert.deepEqual(user.estimates, {
      age: 40,
      bmi: 21.7, // 61,3 / 1,68²
      maxHr: 180, // Tanaka: 208 − 0,7 × 40
      hrReserve: 128, // 180 − 52
    });
  });

  it('el registro sin datos de perfil sigue funcionando', async () => {
    const res = await register({});
    assert.equal(res.status, 201);
    assert.equal(res.body.user.name, null);
    assert.deepEqual(res.body.user.estimates, { age: null, bmi: null, maxHr: null, hrReserve: null });
  });

  it('login y /me devuelven el perfil con estimaciones', async () => {
    await register(PROFILE);
    const login = await request(app).post('/api/auth/login').send({ email: 'laura@test.local', password: PASSWORD });
    assert.equal(login.body.user.name, 'Laura Pérez');
    assert.equal(login.body.user.estimates.age, 40);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    assert.equal(me.body.user.estimates.maxHr, 180);
  });

  const invalid = [
    ['menor de 10 años', { birthDate: birthDateForAge(5) }],
    ['fecha de nacimiento no válida', { birthDate: '1990-02-31' }],
    ['sexo desconocido', { sex: 'x' }],
    ['altura imposible', { heightCm: 300 }],
    ['peso imposible', { weightKg: 10 }],
    ['FC reposo ≥ FC máx', { restingHr: 90, maxHr: 90 }],
    ['nombre vacío', { name: '   ' }],
    ['campo desconocido', { apodo: 'Lau' }],
  ];
  for (const [name, body] of invalid) {
    it(`registro con ${name} → 400`, async () => {
      assert.equal((await register(body)).status, 400);
    });
  }

  describe('PATCH /api/auth/me', () => {
    let token;
    const patch = (body) => request(app).patch('/api/auth/me').set('Authorization', `Bearer ${token}`).send(body);
    beforeEach(async () => {
      token = (await register(PROFILE)).body.token;
    });

    it('actualiza y borra campos del perfil', async () => {
      let res = await patch({ name: 'Laura P.', weightKg: 60 });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.name, 'Laura P.');
      assert.equal(res.body.user.estimates.bmi, 21.3);
      res = await patch({ weightKg: null });
      assert.equal(res.body.user.weightKg, null);
      assert.equal(res.body.user.estimates.bmi, null);
    });

    it('la FC máx. del perfil sustituye a la estimada en la reserva', async () => {
      const res = await patch({ maxHr: 190 });
      assert.equal(res.body.user.estimates.maxHr, 180); // la estimación por edad no cambia
      assert.equal(res.body.user.estimates.hrReserve, 138); // 190 − 52
    });

    it('valida la FC en reposo contra la máxima ya guardada', async () => {
      await patch({ maxHr: 150 });
      assert.equal((await patch({ restingHr: 160 })).status, 400);
    });

    it('no permite borrar el nombre ni cambiar el email', async () => {
      assert.equal((await patch({ name: null })).status, 400);
      assert.equal((await patch({ email: 'otro@test.local' })).status, 400);
    });
  });

  it('las zonas usan la FC máx. estimada por edad si supera a la registrada', async () => {
    const { token } = (await register(PROFILE)).body;
    await request(app).post('/api/activities').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Suave', date: '2026-09-20', distanceKm: 30, durationMin: 60, avgHr: 130, maxHr: 150 });
    const zones = await request(app).get('/api/stats/hr-zones').set('Authorization', `Bearer ${token}`);
    assert.equal(zones.body.maxHr, 180);
    assert.equal(zones.body.maxHrSource, 'age');
  });
});
