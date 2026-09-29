const Activity = require('../models/activity.model');

// Dos salidas del mismo usuario que empiezan con menos de 2 minutos de diferencia son la misma,
// llegue por donde llegue (un .gpx subido a mano, Strava, el ciclocomputador...)
const SAME_RIDE_WINDOW_MS = 2 * 60 * 1000;

// Salida del usuario que coincide en hora con `date` (null si no hay)
function findSameRide(userId, date) {
  const time = date.getTime();
  return Activity.findStartingBetween(userId, date, {
    from: new Date(time - SAME_RIDE_WINDOW_MS),
    to: new Date(time + SAME_RIDE_WINDOW_MS),
  });
}

// Guarda una salida que llega de un servicio externo. Si ya estaba (misma hora, por otra vía),
// no la duplica: la anota como la misma salida para no volver a traerla.
// Devuelve { activity, created } o null si otra sincronización simultánea ya la ha guardado
async function saveExternalRide(userId, ref, data) {
  try {
    const same = await findSameRide(userId, data.date);
    if (same) {
      await Activity.addImport(same.id, ref);
      return { activity: same, created: false };
    }
    return { activity: await Activity.createImported(userId, data, ref), created: true };
  } catch (err) {
    if (err.code === 'P2002') return null; // esa salida del servicio ya está anotada
    throw err;
  }
}

module.exports = { findSameRide, saveExternalRide, SAME_RIDE_WINDOW_MS };
