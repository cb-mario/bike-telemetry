import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { cn } from 'cn'
import { LogOutIcon, UserIcon } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { Dialog } from './ui/Dialog'
import { Logo } from './Logo'
import { Avatar } from './Avatar'
import { displayName } from '../lib/user'
import { NewActivity } from './NewActivity'
import { Toaster } from './Toaster'
import { DropOverlay } from './FileDrop'
import { useWindowFileDrag } from '../lib/useWindowFileDrag'
import { gpxHasTimes, importRouteGpx } from '../lib/planner'

const SECTIONS = [
  { to: '/', label: 'Resumen', icon: 'M4 13h4v7H4zM10 4h4v16h-4zM16 9h4v11h-4z', end: true },
  { to: '/salidas', label: 'Salidas', icon: 'M5 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm14 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5 15l4-7h5l5 7M9 8l3 7h-7M12 5h3' },
  { to: '/rutas', label: 'Rutas', icon: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14' },
]

function Icon({ d, className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

// Estructura común: navegación fija (arriba en escritorio, abajo en móvil), modal y avisos
export function AppShell() {
  const { user, logout } = useAuth()
  const { dialog, openNewActivity, closeNewActivity, refresh, toast } = useApp()
  const navigate = useNavigate()
  const location = useLocation()

  // GPX soltado sobre la app: con tiempos es una salida grabada; sin tiempos, una ruta planificada
  async function handleDroppedFile(file) {
    if (!/\.gpx$/i.test(file.name)) return toast('Solo se admiten archivos .gpx', 'error')
    if (await gpxHasTimes(file)) return openNewActivity('gpx', file)
    try {
      const route = await importRouteGpx(file)
      toast(`Ruta "${route.name}" importada en Rutas.`, 'success')
      navigate(`/rutas/${route.id}`)
    } catch (err) {
      toast(err.message, 'error')
    }
  }
  const fileDragging = useWindowFileDrag(!dialog, handleDroppedFile)

  return (
    <div className="min-h-svh pb-20 sm:pb-0">
      <header className="sticky top-0 z-[1000] border-b border-zinc-800/80 bg-surface/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Secciones" className="hidden items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950/50 p-1 sm:flex">
            {SECTIONS.map((s) => (
              <NavLink key={s.to} to={s.to} end={s.end}
                className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-150
                  ${isActive ? 'bg-zinc-800 text-zinc-50 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05)]' : 'text-zinc-400 hover:text-zinc-100'}`}>
                <Icon d={s.icon} />
                {s.label}
              </NavLink>
            ))}
          </nav>
          {/* Usuario: menú con acceso al perfil y cierre de sesión */}
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Menú de usuario"
              className={cn('group flex items-center gap-2.5 rounded-full py-1 pr-1 pl-3 transition-colors duration-150 outline-none',
                'hover:bg-zinc-800/60 focus-visible:ring-2 focus-visible:ring-brand-2/60 data-popup-open:bg-zinc-800',
                location.pathname === '/perfil' && 'bg-zinc-800')}>
              <span className="hidden max-w-40 truncate text-sm font-medium text-zinc-200 group-hover:text-white md:inline">{displayName(user)}</span>
              <Avatar user={user} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
                  <span className="truncate text-sm font-medium text-foreground">{displayName(user)}</span>
                  <span className="truncate font-normal">{user.email ?? 'Cuenta de Strava'}</span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => navigate('/perfil')}>
                  <UserIcon />
                  Perfil y zonas de pulso
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>
                  <LogOutIcon />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Transición suave al cambiar de sección */}
      <div key={location.pathname.split('/')[1]} className="animate-page-in">
        <Outlet />
      </div>

      {/* Barra de pestañas inferior en móvil */}
      <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-[1000] border-t border-zinc-800 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        <div className="grid grid-cols-3">
          {SECTIONS.map((s) => (
            <NavLink key={s.to} to={s.to} end={s.end}
              className={({ isActive }) => `relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors
                before:absolute before:top-0 before:h-0.5 before:w-8 before:rounded-full before:bg-brand-2 before:transition-opacity
                ${isActive ? 'text-zinc-50 before:opacity-100' : 'text-zinc-500 before:opacity-0'}`}>
              <Icon d={s.icon} className="size-5" />
              {s.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <Dialog open={Boolean(dialog)} onClose={closeNewActivity} title="Nueva salida"
        description="Importa un archivo GPX o introduce los datos a mano.">
        {dialog && (
          <NewActivity key={`${dialog.mode}-${dialog.file?.name ?? ''}`} initialMode={dialog.mode}
            initialFile={dialog.file} onCreated={refresh} onClose={closeNewActivity} />
        )}
      </Dialog>

      {fileDragging && <DropOverlay />}
      <Toaster />
    </div>
  )
}
