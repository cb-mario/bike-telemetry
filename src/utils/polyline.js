// Algoritmo de polilíneas codificadas de Google (el que usa Strava en summary_polyline)
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm

function decode(str, precision = 5) {
  const factor = 10 ** precision;
  const coords = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  const next = () => {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      if (index >= str.length) throw new Error('Polilínea mal formada');
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < str.length) {
    lat += next();
    lon += next();
    coords.push([lat / factor, lon / factor]);
  }
  return coords;
}

function encode(coords, precision = 5) {
  const factor = 10 ** precision;
  let out = '';
  let prevLat = 0;
  let prevLon = 0;

  const put = (value) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };

  for (const [lat, lon] of coords) {
    const iLat = Math.round(lat * factor);
    const iLon = Math.round(lon * factor);
    put(iLat - prevLat);
    put(iLon - prevLon);
    prevLat = iLat;
    prevLon = iLon;
  }
  return out;
}

module.exports = { decode, encode };
