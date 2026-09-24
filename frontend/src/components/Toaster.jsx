import { useApp } from '../context/AppContext'

const TONE = {
  success: { dot: 'bg-zone-2', label: 'Hecho' },
  error: { dot: 'bg-critical', label: 'Error' },
  info: { dot: 'bg-series', label: 'Aviso' },
}

// Avisos flotantes; el tono va con punto + etiqueta accesible, nunca solo color
export function Toaster() {
  const { toasts, dismiss } = useApp()
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {toasts.map((t) => (
        <div key={t.id} role="status"
          className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-sm text-zinc-100 shadow-2xl shadow-black/50 backdrop-blur-md animate-[dialog-in_200ms_ease-out]">
          <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE[t.tone].dot}`} />
          <span className="sr-only">{TONE[t.tone].label}:</span>
          <p className="flex-1">{t.message}</p>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso"
            className="text-zinc-500 transition-colors hover:text-zinc-100">✕</button>
        </div>
      ))}
    </div>
  )
}
