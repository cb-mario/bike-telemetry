import { Spinner } from './Spinner'

const VARIANTS = {
  primary: 'bg-zinc-100 text-zinc-900 shadow-sm hover:bg-white hover:shadow-md hover:shadow-white/5',
  secondary: 'border border-zinc-800 bg-zinc-900/70 text-zinc-100 hover:border-zinc-700 hover:bg-zinc-800/80',
  ghost: 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100',
  danger: 'text-critical hover:bg-critical/10',
  strava: 'bg-strava text-white shadow-sm hover:bg-[#ff5d1a] hover:shadow-md hover:shadow-strava/25',
}

const SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
}

// Botón con microinteracciones (hover suave, pulsación) y estado de carga
export function Button({
  variant = 'primary', size = 'md', loading = false, disabled, className = '', type = 'button', children, ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`relative inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-all duration-200 ease-out active:scale-[0.97]
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-series
        disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {/* El texto se mantiene (invisible) para que el botón no cambie de ancho al cargar */}
      <span className={`inline-flex items-center gap-2 ${loading ? 'invisible' : ''}`}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
    </button>
  )
}
