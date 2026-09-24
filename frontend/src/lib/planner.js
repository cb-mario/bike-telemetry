import { api, ApiError, tokenStorage } from './api'

export const ROUTING_OPTIONS = [
  { value: 'road', label: 'Carretera' },
  { value: 'gravel', label: 'Gravel' },
  { value: 'trekking', label: 'Paseo' },
  { value: 'straight', label: 'Recta' },
]

export const getLeg = (from, to, routing) => api('/planned-routes/leg', {
  query: { from: `${from.lat},${from.lon}`, to: `${to.lat},${to.lon}`, routing },
})
export const listPlannedRoutes = () => api('/planned-routes')
export const getPlannedRoute = (id) => api(`/planned-routes/${id}`)
export const deletePlannedRoute = (id) => api(`/planned-routes/${id}`, { method: 'DELETE' })
export const savePlannedRoute = (id, route) => (id
  ? api(`/planned-routes/${id}`, { method: 'PUT', body: route })
  : api('/planned-routes', { method: 'POST', body: route }))

// Descarga el GPX (la petición lleva el token, así que no vale un <a href> directo)
export async function downloadGpx(id) {
  const res = await fetch(`/api/planned-routes/${id}/gpx`, {
    headers: { Authorization: `Bearer ${tokenStorage.get()}` },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiError(res.status, data?.error ?? 'No se pudo descargar el GPX')
  }
  const filename = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'ruta.gpx'
  const url = URL.createObjectURL(await res.blob())
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
