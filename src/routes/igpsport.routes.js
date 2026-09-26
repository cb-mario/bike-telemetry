const { Router } = require('express');

const igpsportController = require('../controllers/igpsport.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const { igpsportConnectLimiter } = require('../middlewares/rateLimit');

const router = Router();

router.use(authMiddleware);

router.get('/status', igpsportController.status);
router.post('/connect', igpsportConnectLimiter({ skip: () => process.env.NODE_ENV === 'test' }), igpsportController.connect);
router.post('/sync', igpsportController.sync);
router.post('/disconnect', igpsportController.disconnect);

module.exports = router;
