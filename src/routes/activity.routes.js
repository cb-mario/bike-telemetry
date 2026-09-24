const { Router } = require('express');

const activityController = require('../controllers/activity.controller');
const authMiddleware = require('../middlewares/authMiddleware');

const router = Router();

// Todas las rutas de actividades requieren autenticación
router.use(authMiddleware);

router.get('/', activityController.list);
router.post('/', activityController.create);
router.get('/:id', activityController.getById);
router.patch('/:id', activityController.update);
router.delete('/:id', activityController.remove);

module.exports = router;
