// Textos de cada servicio conectable (el estado viene de /api/connections)
export const SOURCE_INFO = {
  strava: {
    detail: 'Trae tus salidas en bici de Strava.',
    // Guía de marca de Strava: el botón de conectar lleva su naranja
    connectVariant: 'strava',
    // Resultado de la vuelta desde Strava (?strava=...)
    results: {
      connected: ['Cuenta de Strava conectada. Ya puedes sincronizar tus salidas.', 'success'],
      denied: ['Has cancelado la conexión con Strava.', 'info'],
      scope: ['Hace falta permitir el acceso a tus actividades para sincronizar.', 'error'],
      taken: ['Esa cuenta de Strava ya está vinculada a otro usuario.', 'error'],
      error: ['No se pudo conectar con Strava. Inténtalo de nuevo.', 'error'],
    },
  },
}
