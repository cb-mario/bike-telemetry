const { Router } = require('express');

const stravaController = require('../controllers/strava.controller');
const authMiddleware = require('../middlewares/authMiddleware');

const router = Router();

// Pública: la llama el navegador al volver de Strava (el usuario se identifica por "state")
router.get('/callback', stravaController.callback);

router.get('/auth-url', authMiddleware, stravaController.authUrl);
router.get('/status', authMiddleware, stravaController.status);
router.post('/sync', authMiddleware, stravaController.sync);
router.post('/disconnect', authMiddleware, stravaController.disconnect);

module.exports = router;
