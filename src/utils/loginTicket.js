const { signPurpose, readPurpose } = require('./signedToken');

// Ticket de corta duración con el que el callback de un proveedor externo (Google) pasa
// la sesión al frontend. Viaja en el fragmento de la URL (#), que no llega a ningún servidor ni
// queda en los logs, y el frontend lo canjea en POST /api/auth/exchange por el JWT de sesión
const PURPOSE = 'login-ticket';
const TTL = '2m';

function issueLoginTicket(userId, { created }) {
  return signPurpose(PURPOSE, { sub: String(userId), created: Boolean(created) }, TTL);
}

// { userId, created } o null si el ticket no es válido, ha caducado o es de otro tipo
function readLoginTicket(ticket) {
  const payload = readPurpose(ticket, PURPOSE);
  return payload && { userId: Number(payload.sub), created: Boolean(payload.created) };
}

// URL del frontend a la que vuelve un login correcto
const loginRedirect = (frontendUrl, provider, userId, created) =>
  `${frontendUrl}/entrar/${provider}#ticket=${encodeURIComponent(issueLoginTicket(userId, { created }))}`;

module.exports = { issueLoginTicket, readLoginTicket, loginRedirect };
