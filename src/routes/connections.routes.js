const { Router } = require('express');

const connectionsController = require('../controllers/connections.controller');
const authMiddleware = require('../middlewares/authMiddleware');

const router = Router();

router.use(authMiddleware);

router.get('/', connectionsController.list);
router.post('/:provider/connect', connectionsController.connect);
router.post('/:provider/sync', connectionsController.sync);
router.delete('/:provider', connectionsController.disconnect);

module.exports = router;
