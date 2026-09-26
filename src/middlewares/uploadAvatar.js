const multer = require('multer');

const { HttpError } = require('../errors');

// El navegador la reduce a 256 px (unas decenas de kB): 1 MB deja margen sin llenar la BD
const MAX_FILE_MB = 1;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1, fields: 0 },
}).single('file');

// Envuelve multer para traducir sus errores al formato { error } de la API
function uploadAvatar(req, res, next) {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, `La foto supera el máximo de ${MAX_FILE_MB} MB`));
      return next(new HttpError(400, 'Envía una única imagen en el campo "file"'));
    }
    if (err) return next(err);
    if (!req.file) return next(new HttpError(400, 'Envía una imagen en el campo "file"'));
    next();
  });
}

module.exports = uploadAvatar;
