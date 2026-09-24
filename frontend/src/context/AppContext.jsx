import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

// Estado compartido por todas las secciones: modal de nueva salida, avisos y recarga de datos
const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [dialog, setDialog] = useState(null) // { mode, file }
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  const openNewActivity = useCallback((mode = 'gpx', file = null) => setDialog({ mode, file }), [])
  const closeNewActivity = useCallback(() => setDialog(null), [])

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const toast = useCallback((message, tone = 'info') => {
    const id = ++nextId.current
    setToasts((list) => [...list, { id, message, tone }])
    setTimeout(() => dismiss(id), 5000)
  }, [dismiss])

  const value = useMemo(() => ({
    refreshKey, refresh, dialog, openNewActivity, closeNewActivity, toasts, toast, dismiss,
  }), [refreshKey, refresh, dialog, openNewActivity, closeNewActivity, toasts, toast, dismiss])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  return useContext(AppContext)
}
