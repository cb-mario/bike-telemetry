import { api } from './api'

// Servicios de los que llegan salidas, con el estado de la conexión del usuario:
// [{ provider, name, auth, configured, connected, account, lastSyncAt }]
export const getConnections = () => api('/connections')
export const syncConnection = (provider) => api(`/connections/${provider}/sync`, { method: 'POST' })
export const disconnectConnection = (provider) => api(`/connections/${provider}`, { method: 'DELETE' })
export const connectConnection = (provider, body) => api(`/connections/${provider}/connect`, { method: 'POST', body })
