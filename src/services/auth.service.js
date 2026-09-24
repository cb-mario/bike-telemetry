const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../models/user.model');
const { HttpError } = require('../middlewares/errorHandler');

const SALT_ROUNDS = 12;
const JWT_ALGORITHM = 'HS256';

// Hash de relleno: si el email no existe se compara igualmente para que el
// tiempo de respuesta no revele qué emails están registrados
const DUMMY_HASH = bcrypt.hashSync('dummy-password', SALT_ROUNDS);

function signToken(user) {
  return jwt.sign({ sub: String(user.id) }, process.env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
}

async function register(email, password) {
  if (await User.findByEmail(email)) {
    throw new HttpError(409, 'El email ya está registrado');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  let user;
  try {
    user = await User.create({ email, passwordHash });
  } catch (err) {
    // Registro simultáneo con el mismo email (violación de unicidad)
    if (err.code === 'P2002') throw new HttpError(409, 'El email ya está registrado');
    throw err;
  }

  return { user, token: signToken(user) };
}

async function login(email, password) {
  const user = await User.findByEmail(email);
  const valid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  if (!user || !valid) {
    throw new HttpError(401, 'Credenciales inválidas');
  }

  const { id, createdAt } = user;
  return { user: { id, email: user.email, createdAt }, token: signToken(user) };
}

module.exports = { register, login, verifyToken };
