const { Router } = require('express');

const connectionsController = require('../controllers/connections.controller');

const router = Router();

// Pública: la llama el navegador al volver de Strava (el usuario se identifica por "state").
// Se queda en /api/strava/callback porque es la URL registrada en Strava (STRAVA_REDIRECT_URI);
// el resto de la conexión va por /api/connections/strava
router.get('/callback', connectionsController.stravaCallback);

module.exports = router;
