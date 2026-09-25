import { api } from './api'

export const getGoogleStatus = () => api('/auth/google/status')
export const unlinkGoogle = () => api('/auth/google', { method: 'DELETE' })

// "Continuar con Google" desde el login: no requiere sesión
export async function loginWithGoogle() {
  const { url } = await api('/auth/google/url')
  window.location.assign(url)
}

// Vincular Google a la cuenta actual (desde el perfil)
export async function linkGoogle() {
  const { url } = await api('/auth/google/link-url')
  window.location.assign(url)
}

// Motivos por los que el login con Google vuelve a la pantalla de acceso (?google_login=...)
export const GOOGLE_LOGIN_ERROR = {
  denied: 'Has cancelado el acceso con Google.',
  exists: 'Ya hay una cuenta con ese email. Entra con tu contraseña y vincula Google desde tu perfil.',
  unverified: 'Tu cuenta de Google no tiene un email verificado.',
  error: 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.',
}

// Resultado de vincular Google desde el perfil (?google=...)
export const GOOGLE_LINK_RESULT = {
  linked: ['Cuenta de Google vinculada. Ya puedes entrar con ella.', 'success'],
  denied: ['Has cancelado la vinculación con Google.', 'info'],
  taken: ['Esa cuenta de Google ya está vinculada a otro usuario.', 'error'],
  error: ['No se pudo vincular Google. Inténtalo de nuevo.', 'error'],
}
