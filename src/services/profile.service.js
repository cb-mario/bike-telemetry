const { ageOn } = require('../utils/profileValidation');

// Estimaciones a partir del perfil (null si faltan datos)
function estimatesFor(user, now = new Date()) {
  const age = user.birthDate ? ageOn(user.birthDate, now) : null;
  const bmi = user.heightCm && user.weightKg
    ? Math.round((user.weightKg / (user.heightCm / 100) ** 2) * 10) / 10
    : null;
  // Fórmula de Tanaka (2001): más precisa que 220 − edad en adultos
  const maxHr = age != null ? Math.round(208 - 0.7 * age) : null;
  const effectiveMaxHr = user.maxHr ?? maxHr;
  return {
    age,
    bmi,
    maxHr,
    // Reserva de FC (Karvonen): base para zonas por intensidad relativa
    hrReserve: effectiveMaxHr && user.restingHr ? effectiveMaxHr - user.restingHr : null,
  };
}

// Usuario público con sus estimaciones
function toPublicUser(user) {
  return user ? { ...user, estimates: estimatesFor(user) } : null;
}

module.exports = { estimatesFor, toPublicUser };
