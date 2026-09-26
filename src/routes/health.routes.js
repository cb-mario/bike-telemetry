const { Router } = require('express');

const prisma = require('../models/prisma');

const router = Router();

router.get('/', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Comprueba la conexión con la base de datos. Un cron de Vercel la llama a diario para que
// Supabase (plan gratis) no pause el proyecto por inactividad
router.get('/db', async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok' });
});

module.exports = router;
