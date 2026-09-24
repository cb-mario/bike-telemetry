const { Router } = require('express');

const activityController = require('../controllers/activity.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const uploadGpx = require('../middlewares/uploadGpx');

const router = Router();

// Todas las rutas de actividades requieren autenticación
router.use(authMiddleware);

router.get('/', activityController.list);
router.get('/routes', activityController.routes);
router.post('/', activityController.create);
router.post('/upload-gpx', uploadGpx, activityController.uploadGpx);
router.get('/:id', activityController.getById);
router.get('/:id/track', activityController.getTrack);
router.patch('/:id', activityController.update);
router.delete('/:id', activityController.remove);

module.exports = router;
