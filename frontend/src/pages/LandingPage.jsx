import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/Logo'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Icon } from '../components/ui/Icon'
import { RoutePreview } from '../components/RoutePreview'
import { ElevationProfile } from '../components/ElevationProfile'
import { DEMO_POINTS, DEMO_RIDE, DEMO_SEGMENTS } from '../lib/demoRide'
import { formatDuration, formatNumber } from '../lib/format'
import { useCountUp } from '../lib/useCountUp'
import { ZONE_BG } from '../lib/zones'

// Cada función lleva un dato concreto de la app, en sus propias unidades
const FEATURES = [
  {
    icon: 'upload', title: 'Importa sin teclear', fact: 'Strava · .gpx',
    text: 'Conecta Strava o suelta un archivo GPX. Distancia, desnivel, tiempo en movimiento y pulso se calculan solos.',
  },
  {
    icon: 'heartPulse', title: 'Tu pulso, por zonas', fact: 'Z1 – Z5',
    text: 'Cinco zonas a partir de tu FC máxima, la que tú indiques o la estimada por tu edad. Cada salida cae en la suya.',
  },
  {
    icon: 'chart', title: 'Tu evolución, semana a semana', fact: '4 semanas · 12 semanas · 12 meses',
    text: 'Distancia, desnivel y tiempo por semana o por mes, en gráfico o en tabla, para ver si de verdad vas a más.',
  },
  {
    icon: 'map', title: 'Rutas para el ciclocomputador', fact: 'Carretera · gravel · trekking',
    text: 'Traza la próxima salida en el mapa ajustada a las vías, mira su perfil de altitud y exporta el GPX.',
  },
]

const STEPS = [
  { title: 'Crea tu cuenta', text: 'Email y contraseña. Si añades tu edad y tu FC en reposo, las zonas de pulso se ajustan a ti.' },
  { title: 'Trae tus salidas', text: 'Conecta Strava para sincronizarlas o arrastra tus archivos GPX a la app.' },
  { title: 'Analiza y planifica', text: 'Revisa tu progresión y tus zonas, y dibuja la próxima ruta para llevarla al ciclocomputador.' },
]

// Cifra que cuenta hacia arriba al aparecer (respeta prefers-reduced-motion)
function CountUp({ value, decimals = 0 }) {
  const current = useCountUp(value)
  return formatNumber(current ?? 0, decimals)
}

const ZONE_NAMES = ['Recuperación', 'Resistencia', 'Tempo', 'Umbral', 'VO2 máx']

// Landing pública previa al registro (/inicio)
export function LandingPage() {
  const { user } = useAuth()

  return (
    <div className="min-h-svh">
      <LandingNav signedIn={Boolean(user)} />
      <main>
        <Hero signedIn={Boolean(user)} />
        <Features />
        <HowItWorks />
        <FinalCta signedIn={Boolean(user)} />
      </main>
      <LandingFooter />
    </div>
  )
}

function LandingNav({ signedIn }) {
  return (
    <header className="sticky top-0 z-[1000] border-b border-zinc-800/80 bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/inicio" aria-label="BikeTelemetry, inicio" className="rounded-md focus-visible:outline-2 focus-visible:outline-brand-2">
          <Logo />
        </Link>
        <nav aria-label="Secciones de la página" className="hidden items-center gap-1 md:flex">
          <a href="#funciones" className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-100">Funciones</a>
          <a href="#como-funciona" className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-100">Cómo funciona</a>
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {signedIn ? (
            <Button as={Link} to="/" size="sm" className="sm:h-9 sm:px-4 sm:text-sm">Ir a tu resumen</Button>
          ) : (
            <>
              <Button as={Link} to="/" variant="ghost" size="sm" className="sm:h-9 sm:px-4 sm:text-sm">Entrar</Button>
              <Button as={Link} to="/registro" size="sm" className="sm:h-9 sm:px-4 sm:text-sm">Crear cuenta</Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function Hero({ signedIn }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 lg:grid-cols-12 lg:gap-12 lg:pt-20 lg:pb-24">
      <div className="min-w-0 animate-rise-in lg:col-span-5">
        <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-zinc-50 sm:text-5xl lg:text-[3.5rem]">
          Cada kilómetro, medido.
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-pretty text-zinc-400 sm:text-lg">
          Registra tus salidas en bici, entiende tu pulso por zonas y planifica la próxima ruta para tu ciclocomputador. Lo que ya has rodado y lo que vas a rodar, en un mismo sitio.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {signedIn ? (
            <Button as={Link} to="/" className="h-11 px-6 text-base">Ir a tu resumen</Button>
          ) : (
            <>
              <Button as={Link} to="/registro" className="h-11 px-6 text-base">
                Crear cuenta
                <Icon name="chevronRight" className="size-4" />
              </Button>
              <Button as={Link} to="/" variant="secondary" className="h-11 px-6 text-base">Ya tengo cuenta</Button>
            </>
          )}
        </div>
        <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-500">
          <li className="flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-full bg-strava" />Sincroniza con Strava</li>
          <li className="flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-full bg-zinc-600" />Importa y exporta GPX</li>
        </ul>
      </div>
      <div className="min-w-0 animate-rise-in [animation-delay:80ms] lg:col-span-7">
        <DemoRide />
      </div>
    </section>
  )
}

// Vista previa con componentes reales de la app sobre una salida de ejemplo.
// El perfil de altitud mueve el punto sobre el trazado, igual que en el detalle de una salida
function DemoRide() {
  const [hover, setHover] = useState({ index: null, point: null })
  const r = DEMO_RIDE
  const active = hover.point ? [hover.point.lat, hover.point.lon] : null
  const readings = [
    { label: 'Distancia', value: <CountUp value={r.distanceKm} decimals={1} />, unit: 'km', mark: 'bg-dist' },
    { label: 'Tiempo', value: formatDuration(r.durationMin), mark: 'bg-zinc-500' },
    { label: 'Desnivel', value: <CountUp value={r.elevationGain} />, unit: 'm', mark: 'bg-elev' },
    { label: 'FC media', value: <CountUp value={r.avgHr} />, unit: 'bpm', mark: 'bg-hr' },
  ]

  return (
    <Card as="figure" className="overflow-hidden shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_32px_64px_-32px_rgb(0_0_0/0.8)]"
      aria-label="Vista previa de BikeTelemetry con una salida de ejemplo">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">{r.title}</p>
          <p className="text-xs text-zinc-500">Carretera · 1 puerto</p>
        </div>
        <span className="shrink-0 rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] font-medium text-zinc-400">Datos de ejemplo</span>
      </div>

      <dl className="grid grid-cols-2 gap-px border-b border-zinc-800 bg-zinc-800 sm:grid-cols-4">
        {readings.map((m) => (
          <div key={m.label} className="bg-zinc-900 px-4 py-3 sm:px-5">
            <dt className="flex items-center gap-2 text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
              <span aria-hidden className={`h-3 w-0.5 rounded-full ${m.mark}`} />{m.label}
            </dt>
            <dd className="mt-1.5 text-xl font-semibold tracking-tight text-zinc-100 tabular-nums sm:text-2xl">
              {m.value}{m.unit && <span className="ml-1 text-sm font-normal tracking-normal text-zinc-400">{m.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-px bg-zinc-800 sm:grid-cols-[1fr_13rem]">
        <div className="flex items-center justify-center bg-zinc-950/60 py-3">
          <RoutePreview segments={DEMO_SEGMENTS} width={360} height={190} padding={16} markers active={active}
            strokeWidth={2.5} className="h-auto w-full max-w-[360px]" />
        </div>
        <div className="bg-zinc-900 px-4 py-4 sm:px-5">
          <p className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">Tiempo por zona</p>
          <ul className="mt-3 flex flex-col gap-2">
            {[...r.zoneShare].map((share, i) => ({ share, i })).reverse().map(({ share, i }) => (
              <li key={i} className="grid grid-cols-[1.75rem_1fr_2.25rem] items-center gap-2 text-xs">
                <span className="font-medium text-zinc-300" title={ZONE_NAMES[i]}>Z{i + 1}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <span className={`block h-full origin-left rounded-full animate-grow-x ${ZONE_BG[i]}`} style={{ width: `${share * 100}%` }} />
                </span>
                <span className="text-right text-zinc-400 tabular-nums">{Math.round(share * 100)} %</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-zinc-800 px-3 pt-3 pb-1 sm:px-4">
        <p className="mb-2 px-1 text-xs text-zinc-500">
          <span className="hidden sm:inline">Pasa el cursor</span><span className="sm:hidden">Desliza el dedo</span> por el perfil para situarte en el mapa
        </p>
        <ElevationProfile points={DEMO_POINTS} height={150} activeIndex={hover.index}
          onActiveChange={(index, point) => setHover({ index, point })} />
      </div>
    </Card>
  )
}

function Features() {
  return (
    <section id="funciones" aria-labelledby="funciones-titulo" className="scroll-mt-20 border-t border-zinc-800/70">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="max-w-2xl">
          <h2 id="funciones-titulo" className="text-3xl font-semibold tracking-tight text-balance text-zinc-50 sm:text-4xl">
            Todo lo que pasa en tus salidas, sin hojas de cálculo
          </h2>
          <p className="mt-3 text-base text-pretty text-zinc-400">
            Los datos que ya grabas, convertidos en respuestas: cuánto has rodado, a qué intensidad y hacia dónde vas.
          </p>
        </div>
        <ul className="stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <li key={f.title} style={{ '--i': i }}>
              <Card as="div" className="flex h-full flex-col gap-4 p-5">
                <span className="flex size-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/60 text-zinc-300">
                  <Icon name={f.icon} className="size-[18px]" />
                </span>
                <div className="flex-1">
                  <h3 className="text-base font-medium text-zinc-100">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{f.text}</p>
                </div>
                <p className="border-t border-zinc-800 pt-3 text-xs font-medium text-zinc-300 tabular-nums">{f.fact}</p>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="scroll-mt-20 border-t border-zinc-800/70">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <h2 id="como-funciona-titulo" className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          En marcha en tres pasos
        </h2>
        <Card as="div" className="mt-10 overflow-hidden">
          <ol className="stagger grid gap-px bg-zinc-800 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} style={{ '--i': i }} className="flex gap-4 bg-zinc-900 p-5 sm:p-6 md:flex-col">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-sm font-semibold text-zinc-200 tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-base font-medium text-zinc-100">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </section>
  )
}

function FinalCta({ signedIn }) {
  return (
    <section aria-labelledby="cta-titulo" className="border-t border-zinc-800/70">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <Card as="div" className="px-6 py-10 sm:px-10 sm:py-12">
          <div className="max-w-xl">
            <h2 id="cta-titulo" className="text-3xl font-semibold tracking-tight text-balance text-zinc-50 sm:text-4xl">
              Tu próxima salida ya tiene dónde quedarse
            </h2>
            <p className="mt-3 text-base text-pretty text-zinc-400">
              Crea tu cuenta, trae tus salidas y empieza a ver tu progresión desde hoy.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {signedIn ? (
                <Button as={Link} to="/" className="h-11 px-6 text-base">Ir a tu resumen</Button>
              ) : (
                <>
                  <Button as={Link} to="/registro" className="h-11 px-6 text-base">Crear cuenta</Button>
                  <Button as={Link} to="/" variant="ghost" className="h-11 px-6 text-base">Ya tengo cuenta</Button>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}

function LandingFooter() {
  return (
    <footer className="border-t border-zinc-800/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-xs text-zinc-500">Registro y análisis de salidas en bici. © {new Date().getFullYear()} BikeTelemetry.</p>
        </div>
        <nav aria-label="Pie de página" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
          <a href="#funciones" className="transition-colors hover:text-zinc-100">Funciones</a>
          <a href="#como-funciona" className="transition-colors hover:text-zinc-100">Cómo funciona</a>
          <Link to="/" className="transition-colors hover:text-zinc-100">Entrar</Link>
          <Link to="/registro" className="transition-colors hover:text-zinc-100">Crear cuenta</Link>
        </nav>
      </div>
    </footer>
  )
}
