import { Link } from 'react-router'
import { Logo } from '../Logo'

// Salida de muestra: un bucle irregular (como una vuelta real) y su perfil, generados una vez
const LOOP = Array.from({ length: 120 }, (_, i) => {
  const t = (i / 119) * Math.PI * 2
  const r = 1 + 0.2 * Math.sin(3 * t + 0.6) + 0.09 * Math.sin(7 * t + 1.3) + 0.035 * Math.sin(17 * t)
  return [300 + Math.cos(t) * r * 200, 135 + Math.sin(t) * r * 105]
})
const ROUTE = LOOP.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
const ELEVATION = LOOP.map((_, i) => {
  const t = (i / 119) * Math.PI * 2
  return 40 - 18 * Math.sin(t - 0.4) - 8 * Math.sin(3 * t + 1) - 2.5 * Math.sin(11 * t)
})
const PROFILE_LINE = ELEVATION.map((y, i) => `${i ? 'L' : 'M'}${((i / 119) * 600).toFixed(1)} ${y.toFixed(1)}`).join('')
const PROFILE = `${PROFILE_LINE}L600 72L0 72Z`
const [START_X, START_Y] = LOOP[0]

// El lienzo se ajusta al recorrido (con margen para el trazo y el punto de salida) para que nunca se recorte
const PAD = 12
const xs = LOOP.map(([x]) => x)
const ys = LOOP.map(([, y]) => y)
const VIEW_BOX = [
  Math.min(...xs) - PAD,
  Math.min(...ys) - PAD,
  Math.max(...xs) - Math.min(...xs) + PAD * 2,
  Math.max(...ys) - Math.min(...ys) + PAD * 2,
].map((n) => n.toFixed(1)).join(' ')

const READINGS = [
  { label: 'Distancia', value: '86,4', unit: 'km', mark: 'bg-dist' },
  { label: 'Desnivel', value: '1.240', unit: 'm', mark: 'bg-elev' },
  { label: 'FC media', value: '142', unit: 'bpm', mark: 'bg-hr' },
  { label: 'Tiempo', value: '3 h 12', unit: 'min', mark: 'bg-zinc-500' },
]

export function AuthHero() {
  return (
    <div className="relative hidden flex-col justify-between gap-8 border-r border-zinc-800/70 p-12 lg:flex [@media(max-height:800px)]:py-8">
      <Link to="/inicio" aria-label="Conoce BikeTelemetry" className="self-start rounded-md focus-visible:outline-2 focus-visible:outline-brand-2">
        <Logo />
      </Link>
      <div>
        <h1 className="max-w-md text-5xl leading-[1.05] font-semibold tracking-tight text-balance text-zinc-50">
          Cada kilómetro, medido.
        </h1>
        <p className="mt-5 max-w-sm text-base leading-relaxed text-zinc-400">
          Registra tus salidas, entiende tu pulso y planifica la próxima ruta para tu ciclocomputador.
        </p>

        <figure className="mt-8 max-w-xl [@media(min-height:860px)]:mt-12" aria-hidden>
          <svg viewBox={VIEW_BOX} preserveAspectRatio="xMinYMid meet" className="h-auto max-h-[34svh] w-full [@media(max-height:800px)]:max-h-[28svh]">
            <path d={ROUTE} fill="none" stroke="#222e55" strokeWidth="1.5" strokeDasharray="2 5" strokeLinecap="round" />
            <path d={ROUTE} fill="none" stroke="#4f9dff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              pathLength="1000" strokeDasharray="1000"
              className="[--path-length:1000] animate-[draw_2.4s_cubic-bezier(0.65,0,0.35,1)_0.2s_both]" />
            <circle cx={START_X} cy={START_Y} r="6" fill="#eaf0fb" stroke="#131d3b" strokeWidth="3" />
          </svg>
          <svg viewBox="0 0 600 72" preserveAspectRatio="none" className="mt-4 h-14 w-full [@media(max-height:800px)]:hidden">
            <path d={PROFILE} className="fill-elev/20" />
            <path d={PROFILE_LINE} fill="none" className="stroke-elev" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <dl className="mt-5 grid grid-cols-4 gap-6 border-t border-zinc-800 pt-5">
            {READINGS.map((r) => (
              <div key={r.label}>
                <dt className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className={`h-3 w-0.5 rounded-full ${r.mark}`} />{r.label}
                </dt>
                <dd className="mt-1 text-lg font-semibold tracking-tight text-zinc-100 tabular-nums">
                  {r.value} <span className="text-sm font-normal text-zinc-400">{r.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        </figure>
      </div>
      <p className="text-xs text-zinc-500">Tus datos, tus rutas. Sin distracciones.</p>
    </div>
  )
}
