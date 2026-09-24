import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { useAuth } from './context/AuthContext'
import { AppProvider } from './context/AppContext'
import { AuthPage } from './pages/AuthPage'
import { AppShell } from './components/AppShell'
import { SummaryPage } from './pages/SummaryPage'
import { RoutesPage } from './pages/RoutesPage'
import { ExplorerPage } from './pages/ExplorerPage'
import { ActivityDetailPage } from './pages/ActivityDetailPage'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center" aria-busy="true">
        <div className="size-5 animate-spin rounded-full border-2 border-zinc-800 border-t-ink-secondary" />
      </div>
    )
  }
  if (!user) return <AuthPage />

  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<SummaryPage />} />
            <Route path="rutas" element={<RoutesPage />} />
            <Route path="rutas/:id" element={<ActivityDetailPage />} />
            <Route path="explorar" element={<ExplorerPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  )
}
