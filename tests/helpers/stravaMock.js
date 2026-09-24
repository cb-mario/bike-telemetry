// Sustituye fetch por un Strava simulado; registra cada llamada para poder comprobarla
const realFetch = globalThis.fetch;

function json(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockStrava(routes) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.hostname !== 'www.strava.com') return realFetch(input, init);
    const call = {
      method: init.method || 'GET',
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: init.headers || {},
      body: init.body ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const handler = routes[`${call.method} ${call.path}`] ?? routes[call.path];
    if (!handler) return json(404, { message: 'Not Found' });
    const [status, body] = await handler(call);
    return json(status, body);
  };
  return calls;
}

function restoreFetch() {
  globalThis.fetch = realFetch;
}

// Actividad de Strava con valores por defecto realistas
function stravaActivity(overrides = {}) {
  return {
    id: 1001,
    name: 'Morning Ride',
    type: 'Ride',
    sport_type: 'Ride',
    start_date: '2026-09-20T07:00:00Z',
    distance: 42195.3,
    moving_time: 5400,
    total_elevation_gain: 612.4,
    has_heartrate: true,
    average_heartrate: 141.6,
    max_heartrate: 178.2,
    max_speed: 15.27,
    map: { summary_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
    ...overrides,
  };
}

module.exports = { mockStrava, restoreFetch, stravaActivity, json };
