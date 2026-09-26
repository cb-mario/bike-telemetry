const { Router } = require('express');

const avatarController = require('../controllers/avatar.controller');

const router = Router();

router.get('/:id', avatarController.show);

module.exports = router;
