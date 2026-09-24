// Nombre visible: el del perfil o, si aún no lo tiene, la parte local del email con mayúscula
export function displayName(user) {
  if (user?.name) return user.name
  const local = user?.email?.split('@')[0] ?? ''
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'Ciclista'
}

export function initials(user) {
  const parts = displayName(user).split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase() || '?'
}

export const SEX_OPTIONS = [
  { value: 'female', label: 'Mujer' },
  { value: 'male', label: 'Hombre' },
  { value: 'other', label: 'Otro' },
]

// Categoría del IMC según la OMS
export function bmiCategory(bmi) {
  if (bmi == null) return null
  if (bmi < 18.5) return 'Bajo peso'
  if (bmi < 25) return 'Peso saludable'
  if (bmi < 30) return 'Sobrepeso'
  return 'Obesidad'
}

// Estimación de FC máxima por edad (Tanaka), igual que el backend
export const estimatedMaxHr = (age) => (age != null ? Math.round(208 - 0.7 * age) : null)

export function ageFromBirthDate(iso) {
  if (!iso) return null
  const b = new Date(iso)
  if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getUTCFullYear() - b.getUTCFullYear()
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) age -= 1
  return age
}

// Calorías de una salida por pulso (Keytel et al., 2005). Sin sexo definido, media de ambas fórmulas
export function estimateCalories({ avgHr, durationMin }, user) {
  const age = user?.estimates?.age
  const w = user?.weightKg
  if (avgHr == null || !durationMin || age == null || !w) return null
  const male = (-55.0969 + 0.6309 * avgHr + 0.1988 * w + 0.2017 * age) / 4.184
  const female = (-20.4022 + 0.4472 * avgHr - 0.1263 * w + 0.074 * age) / 4.184
  const perMin = user.sex === 'male' ? male : user.sex === 'female' ? female : (male + female) / 2
  return perMin > 0 ? Math.round(perMin * durationMin) : null
}
