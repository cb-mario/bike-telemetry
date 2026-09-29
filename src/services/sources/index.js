const { HttpError } = require('../../errors');
const strava = require('./strava.source');
const igpsport = require('./igpsport.source');

// Servicios de los que llegan salidas. Cada uno tiene la misma forma:
//   id, name          identificador ("strava") y nombre para mostrar
//   auth              cómo se conecta: "oauth" (connect devuelve { url } a la que ir) o
//                     "credentials" (connect recibe el body con usuario y contraseña)
//   isConfigured()    si el servidor tiene lo necesario para ofrecerlo
//   connect(userId, body)
//   sync(userId)      trae las salidas nuevas → { imported, alreadyImported, duplicates, hasMore, lastSyncAt, ... }
//   disconnect(userId)
// La conexión de cada usuario se guarda en Connection y las salidas pasan por import.service,
// que evita duplicados entre fuentes
const SOURCES = [igpsport, strava];

function getSource(provider) {
  const source = SOURCES.find((s) => s.id === provider);
  if (!source) throw new HttpError(404, `Servicio no encontrado: ${provider}`);
  return source;
}

module.exports = { SOURCES, getSource };
