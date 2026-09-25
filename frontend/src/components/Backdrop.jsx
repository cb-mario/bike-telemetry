// Fondo: azul marino liso con una luz cenital muy tenue y estática, para dar profundidad sin distraer
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-surface">
      <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(60rem_28rem_at_50%_-8rem,rgb(37_99_235/0.16),transparent_70%)]" />
    </div>
  )
}
