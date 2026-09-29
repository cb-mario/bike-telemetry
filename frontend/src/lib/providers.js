import { api } from './api'
import { useApiQuery } from './useApiQuery'

// Accesos externos configurados en el servidor ({ google }). Se pide una vez por sesión
// del navegador: solo cambia al desplegar con otras variables de entorno
let request
const getProviders = () => (request ??= api('/auth/providers').catch((err) => {
  request = undefined
  throw err
}))

// undefined mientras carga; si falla, ninguno (la interfaz no ofrece lo que no puede comprobar)
export function useProviders() {
  const { data, error } = useApiQuery(getProviders, [])
  return error ? { google: false } : data
}
