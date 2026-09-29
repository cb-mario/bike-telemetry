const { Router } = require('express');

const connectionsController = require('../controllers/connections.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const { connectLimiter } = require('../middlewares/rateLimit');

const router = Router();

router.use(authMiddleware);

router.get('/', connectionsController.list);
router.post('/:provider/connect', connectLimiter({ skip: () => process.env.NODE_ENV === 'test' }), connectionsController.connect);
router.post('/:provider/sync', connectionsController.sync);
router.delete('/:provider', connectionsController.disconnect);

module.exports = router;
