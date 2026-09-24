import { useAuth } from './context/AuthContext'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center" aria-busy="true">
        <div className="size-5 animate-spin rounded-full border-2 border-zinc-800 border-t-ink-secondary" />
      </div>
    )
  }
  return user ? <DashboardPage /> : <AuthPage />
}
