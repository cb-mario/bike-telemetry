import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setUnauthorizedHandler, tokenStorage } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Si hay token guardado, se valida con /auth/me antes de mostrar nada
  const [loading, setLoading] = useState(() => Boolean(tokenStorage.get()))

  const logout = useCallback(() => {
    tokenStorage.set(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!tokenStorage.get()) return
    api('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => logout())
      .finally(() => setLoading(false))
  }, [logout])

  // profile: datos opcionales del registro por pasos (nombre, edad, altura…)
  const authenticate = useCallback(async (mode, email, password, profile = {}) => {
    const { user, token } = await api(`/auth/${mode}`, { method: 'POST', body: { email, password, ...profile } })
    tokenStorage.set(token)
    setUser(user)
  }, [])

  const value = useMemo(
    () => ({ user, setUser, loading, authenticate, logout }),
    [user, loading, authenticate, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
