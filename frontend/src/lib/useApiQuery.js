import { useCallback, useEffect, useState } from 'react'

// Pide datos a la API cuando cambian `deps` (valores serializables en JSON). Mientras recarga
// conserva los datos anteriores, y descarta la respuesta de una petición que ya no es la actual.
// `loading` es true hasta que termina la petición de las `deps` actuales
export function useApiQuery(fetcher, deps) {
  const key = JSON.stringify(deps)
  const [state, setState] = useState({ data: undefined, error: '', settledKey: null })

  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(fetcher)
      .then(
        (data) => !cancelled && setState({ data, error: '', settledKey: key }),
        (err) => !cancelled && setState((s) => ({ ...s, error: err.message, settledKey: key })),
      )
    return () => {
      cancelled = true
    }
    // El fetcher es un cierre nuevo en cada render: la petición depende solo de `deps`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Para actualizar los datos en local (p. ej. añadir una página más) sin volver a pedirlos
  const setData = useCallback((update) => {
    setState((s) => ({ ...s, data: typeof update === 'function' ? update(s.data) : update }))
  }, [])

  return { data: state.data, error: state.error, loading: state.settledKey !== key, setData }
}
