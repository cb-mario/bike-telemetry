const multer = require('multer');

const { HttpError } = require('../errors');

const MAX_FILE_MB = 15;

// Middleware de subida de un único archivo con alguna de las extensiones indicadas.
// El archivo queda en memoria (se parsea y se descarta; solo se guardan los datos calculados)
function uploadFile(extensions) {
  const list = extensions.map((ext) => `.${ext}`).join(' o ');
  const pattern = new RegExp(`\\.(${extensions.join('|')})$`, 'i');

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1, fields: 5 },
    fileFilter(req, file, cb) {
      if (!pattern.test(file.originalname)) {
        return cb(new HttpError(400, `Solo se admiten archivos ${list}`));
      }
      cb(null, true);
    },
  }).single('file');

  // Envuelve multer para traducir sus errores al formato { error } de la API
  return function uploadMiddleware(req, res, next) {
    upload(req, res, (err) => {
      if (!err) return next();
      if (err instanceof HttpError) return next(err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new HttpError(413, `El archivo supera el máximo de ${MAX_FILE_MB} MB`));
        }
        return next(new HttpError(400, `Envía un único archivo ${list} en el campo "file"`));
      }
      next(err);
    });
  };
}

const uploadGpx = uploadFile(['gpx']);
// Salidas grabadas: GPX o FIT (el formato nativo de los ciclocomputadores)
uploadGpx.activityFile = uploadFile(['gpx', 'fit']);

module.exports = uploadGpx;
