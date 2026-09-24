const VARIANTS = {
  primary: 'bg-ink text-surface hover:bg-zinc-200',
  secondary: 'border border-zinc-800 bg-zinc-900 text-ink hover:bg-zinc-800',
  ghost: 'text-ink-secondary hover:bg-zinc-900 hover:text-ink',
  danger: 'text-critical hover:bg-critical/10',
}

const SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
}

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-series
        disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  )
}
