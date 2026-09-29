// Genera archivos .fit sintéticos con el SDK oficial de Garmin (como los de un ciclocomputador)
const DEG_TO_SEMICIRCLE = 2 ** 31 / 180;

// `segments`: puntos como los de straightSegment (helpers/gpx). `session`: totales del
// aparato (null = sin mensaje de sesión). Sin segmentos = salida en rodillo, sin GPS.
async function buildFit({ segments = [], session = {}, fileType = 'activity', sport = 'cycling', subSport = 'road' }) {
  const { Encoder, Profile } = await import('@garmin/fitsdk');
  const { MesgNum } = Profile;
  const points = segments.flat();
  const start = session?.startTime ?? points[0]?.time ?? new Date('2026-09-20T08:00:00Z');

  const encoder = new Encoder();
  encoder.onMesg(MesgNum.FILE_ID, {
    type: fileType, manufacturer: 'development', product: 1, timeCreated: start, serialNumber: 1234,
  });
  for (const p of points) {
    encoder.onMesg(MesgNum.RECORD, {
      timestamp: p.time,
      positionLat: Math.round(p.lat * DEG_TO_SEMICIRCLE),
      positionLong: Math.round(p.lon * DEG_TO_SEMICIRCLE),
      ...(p.ele != null && { altitude: p.ele }),
      ...(p.hr != null && { heartRate: p.hr }),
    });
  }
  if (session) {
    encoder.onMesg(MesgNum.SESSION, {
      timestamp: points.at(-1)?.time ?? start, startTime: start, sport, subSport, ...session,
    });
  }
  return Buffer.from(encoder.close());
}

module.exports = { buildFit };
