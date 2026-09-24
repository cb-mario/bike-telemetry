const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const activityRoutes = require('./routes/activity.routes');
const statsRoutes = require('./routes/stats.routes');
const stravaRoutes = require('./routes/strava.routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

// Aplicación Express sin arrancar (server.js la pone a escuchar; los tests la usan directamente)
const app = express();

// Middlewares globales
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/strava', stravaRoutes);

// 404 y errores (siempre al final)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
