import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { useAuth } from './context/AuthContext'
import { AppProvider } from './context/AppContext'
import { AuthPage } from './pages/AuthPage'
import { AppShell } from './components/AppShell'
import { SummaryPage } from './pages/SummaryPage'
import { RidesPage } from './pages/RidesPage'
import { RoutesLibraryPage } from './pages/RoutesLibraryPage'
import { ProfilePage } from './pages/ProfilePage'
import { Backdrop } from './components/Backdrop'

// Las páginas con mapa (Leaflet) se cargan solo al abrirlas
const ActivityDetailPage = lazy(() => import('./pages/ActivityDetailPage').then((m) => ({ default: m.ActivityDetailPage })))
const RouteEditorPage = lazy(() => import('./pages/RouteEditorPage').then((m) => ({ default: m.RouteEditorPage })))

function PageFallback() {
  return (
    <div className="flex min-h-[60svh] items-center justify-center" aria-busy="true">
      <div className="size-5 animate-spin rounded-full border-2 border-zinc-800 border-t-brand-2" />
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center" aria-busy="true">
        <Backdrop />
        <div className="size-5 animate-spin rounded-full border-2 border-zinc-800 border-t-brand-2" />
      </div>
    )
  }
  if (!user) {
    return (
      <>
        <Backdrop />
        <AuthPage />
      </>
    )
  }

  return (
    <BrowserRouter>
      <Backdrop />
      <AppProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<SummaryPage />} />
              {/* Salidas: lo que ya has rodado */}
              <Route path="salidas" element={<RidesPage />} />
              <Route path="salidas/:id" element={<ActivityDetailPage />} />
              {/* Rutas: lo que quieres rodar */}
              <Route path="rutas" element={<RoutesLibraryPage />} />
              <Route path="rutas/nueva" element={<RouteEditorPage />} />
              <Route path="rutas/:id" element={<RouteEditorPage />} />
              <Route path="perfil" element={<ProfilePage />} />
              {/* Direcciones antiguas */}
              <Route path="planificador" element={<Navigate to="/rutas" replace />} />
              <Route path="explorar" element={<Navigate to="/rutas" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </AppProvider>
    </BrowserRouter>
  )
}
