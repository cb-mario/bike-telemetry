import { useEffect, useRef } from 'react'

// Diálogo modal basado en <dialog> nativo (foco atrapado y Escape gratis)
export function Dialog({ open, onClose, title, description, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-zinc-800 bg-surface p-0 text-ink
        shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="p-6">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          <div className="mt-5">{children}</div>
        </div>
      )}
    </dialog>
  )
}
