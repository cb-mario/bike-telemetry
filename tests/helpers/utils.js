const http = require('node:http');
const request = require('supertest');

// Un único servidor por fichero de test. Con request(expressApp) supertest abre y cierra
// un servidor por petición; al reutilizarse puertos, el agente keep-alive de Node puede
// usar una conexión ya cerrada y fallar de forma intermitente con ECONNRESET.
// unref() evita que el servidor mantenga vivo el proceso al terminar los tests.
const app = http.createServer(require('../../src/app')).listen(0);
app.unref();
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
