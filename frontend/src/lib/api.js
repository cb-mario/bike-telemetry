// Cliente HTTP de la API: añade el token y normaliza los errores { error }
const TOKEN_KEY = 'biketelemetry.token'

export const tokenStorage = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      // Sin almacenamiento disponible: la sesión dura lo que la pestaña
    }
  },
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

let onUnauthorized = () => {}
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

export async function api(path, { method = 'GET', body, query } = {}) {
  const url = new URL(`/api${path}`, window.location.origin)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
  }

  const token = tokenStorage.get()
  // FormData (subida de archivos) va tal cual: el navegador pone el Content-Type multipart
  const isForm = body instanceof FormData
  let res
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined && !isForm && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined || isForm ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'No se puede conectar con el servidor')
  }

  if (res.status === 204) return null
  const data = await res.json().catch(() => null)

  // El proxy de Vite responde 502/503/504 sin cuerpo JSON cuando el backend no está arrancado
  if (!data && [502, 503, 504].includes(res.status)) {
    throw new ApiError(res.status, 'No se puede conectar con el servidor. ¿Está arrancado el backend (npm run dev)?')
  }

  if (!res.ok) {
    // Token caducado o inválido en una ruta protegida: cerrar sesión
    if (res.status === 401 && token && !path.startsWith('/auth/login')) onUnauthorized()
    throw new ApiError(res.status, data?.error ?? `Error ${res.status}`)
  }
  return data
}
