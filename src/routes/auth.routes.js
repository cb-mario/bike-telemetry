const { Router } = require('express');

const authController = require('../controllers/auth.controller');
const avatarController = require('../controllers/avatar.controller');
const uploadAvatar = require('../middlewares/uploadAvatar');
const authMiddleware = require('../middlewares/authMiddleware');
const { authLimiters } = require('../middlewares/rateLimit');

const router = Router();
const limit = authLimiters({ skip: () => process.env.NODE_ENV === 'test' });

router.post('/register', limit.register, authController.register);
router.post('/login', limit.login, authController.login);
router.post('/exchange', limit.exchange, authController.exchange);
// Recuperación de contraseña por correo
router.post('/forgot-password', limit.forgotPassword, authController.forgotPassword);
router.post('/reset-password', limit.resetPassword, authController.resetPassword);

// Google: acceso sin contraseña
router.get('/providers', authController.providers);
router.get('/google/url', authController.googleLoginUrl);
// Pública: la llama el navegador al volver de Google (el usuario se identifica por "state")
router.get('/google/callback', authController.googleCallback);
router.get('/google/link-url', authMiddleware, authController.googleLinkUrl);
router.get('/google/status', authMiddleware, authController.googleStatus);
router.delete('/google', authMiddleware, authController.googleUnlink);
router.get('/me', authMiddleware, authController.me);
router.patch('/me', authMiddleware, authController.updateMe);
router.put('/me/avatar', authMiddleware, uploadAvatar, avatarController.upload);
router.delete('/me/avatar', authMiddleware, avatarController.remove);
router.put('/me/password', authMiddleware, limit.changePassword, authController.changePassword);

module.exports = router;
