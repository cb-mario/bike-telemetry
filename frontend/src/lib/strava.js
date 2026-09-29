import { connectConnection, disconnectConnection, getConnections, syncConnection } from './connections'

export const getStravaStatus = async () => (await getConnections()).find((c) => c.provider === 'strava')
export const syncStrava = () => syncConnection('strava')
export const disconnectStrava = () => disconnectConnection('strava')

// Redirige el navegador a la pantalla de autorización de Strava
export async function connectStrava() {
  const { url } = await connectConnection('strava')
  window.location.assign(url)
}

// Mensajes para el resultado que devuelve el callback (?strava=...)
export const STRAVA_RESULT = {
  connected: ['Cuenta de Strava conectada. Ya puedes sincronizar tus salidas.', 'success'],
  denied: ['Has cancelado la conexión con Strava.', 'info'],
  scope: ['Hace falta permitir el acceso a tus actividades para sincronizar.', 'error'],
  taken: ['Esa cuenta de Strava ya está vinculada a otro usuario.', 'error'],
  error: ['No se pudo conectar con Strava. Inténtalo de nuevo.', 'error'],
}
