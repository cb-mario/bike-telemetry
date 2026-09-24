const { Router } = require('express');

const controller = require('../controllers/plannedRoute.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const uploadGpx = require('../middlewares/uploadGpx');

const router = Router();

router.use(authMiddleware);

// Tramo enrutado entre dos puntos (proxy a BRouter)
router.get('/leg', controller.leg);

router.get('/', controller.list);
router.post('/', controller.create);
router.post('/import-gpx', uploadGpx, controller.importGpx);
router.post('/from-activity/:activityId', controller.fromActivity);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.get('/:id/gpx', controller.gpx);

module.exports = router;
