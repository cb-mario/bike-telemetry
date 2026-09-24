require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');

if (!process.env.JWT_SECRET) {
  console.error('Falta la variable de entorno JWT_SECRET (ver .env.example)');
  process.exit(1);
}

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const activityRoutes = require('./routes/activity.routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/activities', activityRoutes);

// 404 y errores (siempre al final)
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚴 BikeTelemetry API escuchando en http://localhost:${PORT}`);
});

module.exports = app;
