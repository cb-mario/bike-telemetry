import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { useAuth } from './context/AuthContext'
import { AppProvider } from './context/AppContext'
import { AppShell } from './components/AppShell'
import { SummaryPage } from './pages/SummaryPage'
import { RidesPage } from './pages/RidesPage'
import { RoutesLibraryPage } from './pages/RoutesLibraryPage'
import { Backdrop } from './components/Backdrop'
import { TooltipProvider } from '@/components/ui/tooltip'

// Carga diferida: páginas con mapa (Leaflet) y las que no se usan a diario (acceso, landing, perfil),
// para que el paquete inicial lleve solo el panel
const page = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })))
const ActivityDetailPage = page(() => import('./pages/ActivityDetailPage'), 'ActivityDetailPage')
const RouteEditorPage = page(() => import('./pages/RouteEditorPage'), 'RouteEditorPage')
const AuthPage = page(() => import('./pages/AuthPage'), 'AuthPage')
const LandingPage = page(() => import('./pages/LandingPage'), 'LandingPage')
const ProviderLoginPage = page(() => import('./pages/ProviderLoginPage'), 'ProviderLoginPage')
const ForgotPasswordPage = page(() => import('./pages/PasswordRecoveryPage'), 'ForgotPasswordPage')
const ResetPasswordPage = page(() => import('./pages/PasswordRecoveryPage'), 'ResetPasswordPage')
const ProfilePage = page(() => import('./pages/ProfilePage'), 'ProfilePage')

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
  // Sin sesión: landing pública en / (y /inicio), acceso en /entrar y alta en /registro.
  // Cualquier otra dirección de la app lleva al acceso
  if (!user) {
    return (
      <BrowserRouter>
        <Backdrop />
        <TooltipProvider delay={250}>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route index element={<LandingPage />} />
              <Route path="inicio" element={<LandingPage />} />
              <Route path="entrar" element={<AuthPage />} />
              <Route path="registro" element={<AuthPage initialMode="register" />} />
              <Route path="entrar/:provider" element={<ProviderLoginPage />} />
              <Route path="recuperar" element={<ForgotPasswordPage />} />
              <Route path="restablecer" element={<ResetPasswordPage />} />
              <Route path="*" element={<Navigate to="/entrar" replace />} />
            </Routes>
          </Suspense>
        </TooltipProvider>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <Backdrop />
      <AppProvider>
        <TooltipProvider delay={250}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* La landing sigue accesible con sesión, con su llamada a la acción apuntando al Resumen */}
            <Route path="inicio" element={<LandingPage />} />
            <Route path="entrar" element={<Navigate to="/" replace />} />
            <Route path="registro" element={<Navigate to="/" replace />} />
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
        </TooltipProvider>
      </AppProvider>
    </BrowserRouter>
  )
}
