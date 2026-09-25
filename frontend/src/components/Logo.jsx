// Símbolo: el perfil de altimetría de un puerto con el punto en la cima, sobre la placa lima de la marca.
// Es lo que hace la app (telemetría de la salida) y se lee bien incluso a 16 px (favicon)
export function LogoMark({ className = 'size-8' }) {
  return (
    <svg viewBox="0 0 32 32" className={`shrink-0 ${className}`} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <path d="M5.5 23.5h21" className="stroke-brand-ink/35" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M5.5 20.5 10 16.5l3 2L19.5 9l7 8.5" fill="none" className="stroke-brand-ink" strokeWidth="2.75"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="19.5" cy="9" r="2.6" className="fill-brand-ink" />
    </svg>
  )
}

// Logotipo: símbolo y nombre en dos tintas («Bike» en blanco, «Telemetry» en gris azulado)
export function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className="font-display text-xl leading-none font-semibold tracking-tight">
        <span className="text-zinc-50">Bike</span><span className="text-zinc-400">Telemetry</span>
      </span>
    </div>
  )
}
