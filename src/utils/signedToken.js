const jwt = require('jsonwebtoken');

const { jwtSecret } = require('../config');

// JWT de un solo uso concreto (state de OAuth, ticket de login…). El propósito va en el payload y
// se exige al leerlo, para que un token emitido para una cosa no sirva para otra
const ALGORITHM = 'HS256';

function signPurpose(purpose, payload, expiresIn) {
  return jwt.sign({ ...payload, purpose }, jwtSecret(), { algorithm: ALGORITHM, expiresIn });
}

// Payload si el token es válido y tiene uno de los propósitos indicados; null en cualquier otro caso
function readPurpose(token, purposes) {
  if (typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token, jwtSecret(), { algorithms: [ALGORITHM] });
    return [].concat(purposes).includes(payload.purpose) ? payload : null;
  } catch {
    return null;
  }
}

module.exports = { signPurpose, readPurpose };
