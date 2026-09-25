import { Icon } from './ui/Icon'

export function DropOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed border-brand-2/70 bg-zinc-900 px-8 py-14 text-center shadow-[0_24px_48px_-12px_rgb(0_0_0/0.6)]">
        <div className="flex size-14 items-center justify-center rounded-full bg-brand text-brand-ink">
          <Icon name="upload" className="size-6" />
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight text-zinc-100">Suelta tu archivo GPX</p>
          <p className="mt-1 text-sm text-zinc-400">
            Con tiempos se guarda como salida; sin ellos, como ruta planificada
          </p>
        </div>
      </div>
    </div>
  )
}
