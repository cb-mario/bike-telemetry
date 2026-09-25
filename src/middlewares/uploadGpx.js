const multer = require('multer');

const { HttpError } = require('../errors');

const MAX_FILE_MB = 15;

// Archivo en memoria (se parsea y se descarta; solo se guardan los datos calculados)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1, fields: 5 },
  fileFilter(req, file, cb) {
    if (!/\.gpx$/i.test(file.originalname)) {
      return cb(new HttpError(400, 'Solo se admiten archivos .gpx'));
    }
    cb(null, true);
  },
}).single('file');

// Envuelve multer para traducir sus errores al formato { error } de la API
function uploadGpx(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof HttpError) return next(err);
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new HttpError(413, `El archivo supera el máximo de ${MAX_FILE_MB} MB`));
      }
      return next(new HttpError(400, 'Envía un único archivo .gpx en el campo "file"'));
    }
    next(err);
  });
}

module.exports = uploadGpx;
