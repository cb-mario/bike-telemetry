const request = require('supertest');

const app = require('../../src/app');
const prisma = require('../../src/models/prisma');

const PASSWORD = 'supersecreta';

async function resetDb() {
  await prisma.activity.deleteMany();
  await prisma.user.deleteMany();
}

// Registra un usuario y devuelve su token
async function registerUser(email) {
  const res = await request(app).post('/api/auth/register').send({ email, password: PASSWORD });
  return res.body.token;
}

module.exports = { app, prisma, request, resetDb, registerUser, PASSWORD };
