import { Spinner } from './Spinner'

const VARIANTS = {
  primary: 'bg-brand font-semibold text-brand-ink shadow-[inset_0_1px_0_0_rgb(255_255_255/0.3),0_1px_2px_0_rgb(0_0_0/0.3)] hover:bg-brand-hover',
  secondary: 'border border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800',
  ghost: 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100',
  danger: 'text-critical hover:bg-critical/10',
  destructive: 'bg-critical/15 text-critical ring-1 ring-critical/40 ring-inset hover:bg-critical/25',
  strava: 'bg-strava text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.16)] hover:bg-[#e54400]',
}

// El lima a media opacidad sobre azul marino queda verde oliva: el principal inactivo pasa a neutro
const PRIMARY_INACTIVE = 'bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700 ring-inset'

const SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
}

// Botón con respuesta al pulsar y estado de carga. Con `as` (p. ej. Link) se pinta como enlace con el mismo estilo
export function Button({
  as: Tag = 'button', variant = 'primary', size = 'md', loading = false, disabled, className = '', type = 'button', children, ...props
}) {
  const buttonProps = Tag === 'button' ? { type, disabled: disabled || loading } : {}
  // Cargando mantiene su color; solo el principal desactivado de verdad cambia de aspecto
  const inactivePrimary = variant === 'primary' && disabled && !loading
  const look = inactivePrimary ? PRIMARY_INACTIVE : `${VARIANTS[variant]} disabled:opacity-50`
  return (
    <Tag
      {...buttonProps}
      aria-busy={loading || undefined}
      className={`relative inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-colors duration-150 ease-out active:translate-y-px
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-2
        disabled:pointer-events-none ${look} ${SIZES[size]} ${className}`}
      {...props}
    >
      {/* El texto se mantiene (invisible) para que el botón no cambie de ancho al cargar */}
      <span className={`inline-flex items-center gap-2 ${loading ? 'invisible' : ''}`}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
    </Tag>
  )
}
