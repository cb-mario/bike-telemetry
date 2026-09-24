import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { Button } from './ui/Button'
import { Dialog } from './ui/Dialog'
import { Logo } from './Logo'
import { NewActivity } from './NewActivity'
import { Toaster } from './Toaster'
import { DropOverlay } from './FileDrop'
import { useWindowFileDrag } from '../lib/useWindowFileDrag'

const SECTIONS = [
  { to: '/', label: 'Resumen', icon: 'M4 13h4v7H4zM10 4h4v16h-4zM16 9h4v11h-4z', end: true },
  { to: '/rutas', label: 'Mis rutas', icon: 'M4 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm16-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 17h7a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h7' },
  { to: '/planificador', label: 'Planificador', icon: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14' },
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
  const { dialog, openNewActivity, closeNewActivity, refresh } = useApp()
  const fileDragging = useWindowFileDrag(!dialog, (file) => openNewActivity('gpx', file))

  return (
    <div className="min-h-svh pb-20 sm:pb-0">
      <header className="sticky top-0 z-[1000] border-b border-zinc-800/80 bg-surface/75 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Secciones" className="hidden items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/70 p-1 sm:flex">
            {SECTIONS.map((s) => (
              <NavLink key={s.to} to={s.to} end={s.end}
                className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200
                  ${isActive ? 'bg-zinc-700/70 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-100'}`}>
                <Icon d={s.icon} />
                {s.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-zinc-500 lg:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={logout}>Salir</Button>
          </div>
        </div>
      </header>

      <Outlet />

      {/* Barra de pestañas inferior en móvil */}
      <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-[1000] border-t border-zinc-800 bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        <div className="grid grid-cols-3">
          {SECTIONS.map((s) => (
            <NavLink key={s.to} to={s.to} end={s.end}
              className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors
                ${isActive ? 'text-zinc-100' : 'text-zinc-500'}`}>
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
