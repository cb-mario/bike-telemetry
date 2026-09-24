const { Router } = require('express');

const statsController = require('../controllers/stats.controller');
const authMiddleware = require('../middlewares/authMiddleware');

const router = Router();

router.use(authMiddleware);

router.get('/summary', statsController.summary);
router.get('/evolution', statsController.evolution);
router.get('/hr-zones', statsController.hrZones);

module.exports = router;
