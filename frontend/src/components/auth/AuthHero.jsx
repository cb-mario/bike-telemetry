import { Logo } from '../Logo'

// Recorrido decorativo que se dibuja solo, con métricas flotando alrededor
const ROUTE = 'M40 300 C 90 230, 130 260, 170 200 S 250 90, 310 130 S 380 250, 430 190 S 500 70, 560 110'

function Pill({ className, dot, value, label }) {
  return (
    <div className={`absolute flex items-center gap-2.5 rounded-2xl border border-zinc-700/60 bg-zinc-900/70 px-3.5 py-2.5 shadow-xl shadow-black/30 backdrop-blur-md animate-float ${className}`}>
      <span aria-hidden className={`size-2 rounded-full ${dot}`} />
      <span className="text-sm font-semibold text-zinc-100 tabular-nums">{value}</span>
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  )
}

export function AuthHero() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
      <Logo />
      <div className="relative">
        <h1 className="max-w-md text-5xl leading-[1.05] font-semibold tracking-tight text-zinc-50">
          Cada kilómetro,{' '}
          <span className="bg-linear-to-r from-brand to-brand-2 bg-clip-text text-transparent">medido.</span>
        </h1>
        <p className="mt-5 max-w-sm text-base leading-relaxed text-zinc-400">
          Registra tus salidas, entiende tu pulso y planifica la próxima ruta para tu ciclocomputador.
        </p>

        <div className="relative mt-12 h-[340px] max-w-xl">
          <svg viewBox="0 0 600 340" className="absolute inset-0 size-full" aria-hidden>
            <defs>
              <linearGradient id="hero-route" x1="0" x2="1">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <path d={ROUTE} fill="none" stroke="url(#hero-route)" strokeWidth="14" strokeOpacity="0.12" strokeLinecap="round" />
            <path d={ROUTE} fill="none" stroke="url(#hero-route)" strokeWidth="3.5" strokeLinecap="round"
              pathLength="1000" strokeDasharray="1000"
              className="[--path-length:1000] animate-[draw_2.8s_cubic-bezier(0.65,0,0.35,1)_0.3s_both]" />
            <circle cx="40" cy="300" r="7" fill="#eaf0fb" stroke="#131d3b" strokeWidth="3" />
            <circle cx="560" cy="110" r="7" fill="#22d3ee" stroke="#131d3b" strokeWidth="3"
              className="animate-[fade-in_400ms_ease-out_3s_both]" />
          </svg>
          <Pill className="top-4 left-6 [animation-delay:0s]" dot="bg-dist" value="86,4 km" label="distancia" />
          <Pill className="top-36 right-4 [animation-delay:1.5s]" dot="bg-hr" value="142 bpm" label="FC media" />
          <Pill className="bottom-2 left-1/3 [animation-delay:3s]" dot="bg-elev" value="1.240 m" label="desnivel" />
        </div>
      </div>
      <p className="text-xs text-zinc-500">Tus datos, tus rutas. Sin distracciones.</p>
    </div>
  )
}
