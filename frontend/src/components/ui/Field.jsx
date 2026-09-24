import { useId } from 'react'

const inputClass = `h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100
  placeholder:text-zinc-600 transition-all duration-200
  hover:border-zinc-700 focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/30
  disabled:opacity-50 [color-scheme:dark]`

export function Input({ className = '', ...props }) {
  return <input className={`${inputClass} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${inputClass} h-auto min-h-20 py-2 ${className}`} {...props} />
}

// Etiqueta + control + ayuda opcional
export function Field({ label, hint, className = '', children }) {
  const id = useId()
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium tracking-wider text-zinc-400 uppercase">{label}</label>
      {children(id)}
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}

export function FormError({ children }) {
  if (!children) return null
  return (
    <p role="alert" className="flex items-center gap-2 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-ink">
      <span aria-hidden className="text-critical">●</span>
      {children}
    </p>
  )
}
