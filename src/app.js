const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { frontendUrl } = require('./config');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const activityRoutes = require('./routes/activity.routes');
const statsRoutes = require('./routes/stats.routes');
const stravaRoutes = require('./routes/strava.routes');
const plannedRouteRoutes = require('./routes/plannedRoute.routes');
const avatarRoutes = require('./routes/avatar.routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const timeZone = require('./middlewares/timeZone');

// Aplicación Express sin arrancar (server.js la pone a escuchar; los tests la usan directamente)
const app = express();

// Detrás de un proxy inverso (nginx, Caddy…), para que el límite de intentos vea la IP real
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// Middlewares globales
app.use(helmet());
// Solo el frontend puede llamar a la API desde el navegador (nunca "*")
app.use(cors({ origin: process.env.CORS_ORIGIN || frontendUrl() }));
// Las rutas planificadas envían su trazado completo (hasta 2 MB); el resto, el límite por defecto (100 kB)
app.use('/api/planned-routes', express.json({ limit: '2mb' }));
app.use(express.json());
app.use(timeZone);

// Rutas
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/strava', stravaRoutes);
app.use('/api/planned-routes', plannedRouteRoutes);
app.use('/api/avatars', avatarRoutes);

// 404 y errores (siempre al final)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
