const jwt = require('jsonwebtoken');

// Ticket de corta duración con el que el callback de un proveedor externo (Strava, Google) pasa
// la sesión al frontend. Viaja en el fragmento de la URL (#), que no llega a ningún servidor ni
// queda en los logs, y el frontend lo canjea en POST /api/auth/exchange por el JWT de sesión
const PURPOSE = 'login-ticket';
const TTL = '2m';

function issueLoginTicket(userId, { created }) {
  return jwt.sign({ sub: String(userId), purpose: PURPOSE, created: Boolean(created) }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: TTL,
  });
}

// { userId, created } o null si el ticket no es válido, ha caducado o es de otro tipo
function readLoginTicket(ticket) {
  if (typeof ticket !== 'string') return null;
  try {
    const payload = jwt.verify(ticket, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.purpose !== PURPOSE) return null;
    return { userId: Number(payload.sub), created: Boolean(payload.created) };
  } catch {
    return null;
  }
}

// URL del frontend a la que vuelve un login correcto
const loginRedirect = (frontendUrl, provider, userId, created) =>
  `${frontendUrl}/entrar/${provider}#ticket=${encodeURIComponent(issueLoginTicket(userId, { created }))}`;

module.exports = { issueLoginTicket, readLoginTicket, loginRedirect };
