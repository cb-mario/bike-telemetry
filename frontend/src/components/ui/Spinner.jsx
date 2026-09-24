export function Spinner({ className = 'size-3.5' }) {
  return (
    <span aria-hidden className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />
  )
}
