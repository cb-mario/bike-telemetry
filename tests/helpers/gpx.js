// Genera GPX sintéticos con resultados conocidos
const STEP_DEG = 0.001; // ≈ 111,195 m hacia el norte por punto

// Segmento recto hacia el norte: n puntos cada `dt` segundos desde `start`
function straightSegment({ n, start, dt = 20, lat0 = 40, ele = () => 600, hr = () => null }) {
  return Array.from({ length: n }, (_, i) => ({
    lat: lat0 + i * STEP_DEG,
    lon: -3,
    ele: ele(i),
    time: new Date(start.getTime() + i * dt * 1000),
    hr: hr(i),
  }));
}

function trkpt({ lat, lon, ele, time, hr }) {
  const eleTag = ele != null ? `<ele>${ele}</ele>` : '';
  const timeTag = time ? `<time>${time.toISOString()}</time>` : '';
  const hrTag = hr != null
    ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${hr}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>`
    : '';
  return `<trkpt lat="${lat}" lon="${lon}">${eleTag}${timeTag}${hrTag}</trkpt>`;
}

function buildGpx({ name = 'Ruta de prueba', segments }) {
  const segs = segments.map((points) => `<trkseg>${points.map(trkpt).join('')}</trkseg>`).join('');
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="tests" xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk>${name ? `<name>${name}</name>` : ''}${segs}</trk>
</gpx>`);
}

module.exports = { STEP_DEG, straightSegment, buildGpx };
