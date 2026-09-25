import { api } from './api'

export const getStravaStatus = () => api('/strava/status')
export const syncStrava = () => api('/strava/sync', { method: 'POST' })
export const disconnectStrava = () => api('/strava/disconnect', { method: 'POST' })

// Redirige el navegador a la pantalla de autorización de Strava
export async function connectStrava() {
  const { url } = await api('/strava/auth-url')
  window.location.assign(url)
}

// "Continuar con Strava" desde el login: no requiere sesión
export async function loginWithStrava() {
  const { url } = await api('/auth/strava/url')
  window.location.assign(url)
}

// Motivos por los que el login con Strava vuelve a la pantalla de acceso (?strava_login=...)
export const STRAVA_LOGIN_ERROR = {
  denied: 'Has cancelado el acceso con Strava.',
  scope: 'Para entrar con Strava hay que permitir el acceso a tus actividades: es lo que BikeTelemetry analiza.',
  error: 'No se pudo iniciar sesión con Strava. Inténtalo de nuevo.',
}

// Mensajes para el resultado que devuelve el callback (?strava=...)
export const STRAVA_RESULT = {
  connected: ['Cuenta de Strava conectada. Ya puedes sincronizar tus salidas.', 'success'],
  denied: ['Has cancelado la conexión con Strava.', 'info'],
  scope: ['Hace falta permitir el acceso a tus actividades para sincronizar.', 'error'],
  taken: ['Esa cuenta de Strava ya está vinculada a otro usuario.', 'error'],
  error: ['No se pudo conectar con Strava. Inténtalo de nuevo.', 'error'],
}
