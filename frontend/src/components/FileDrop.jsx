export function DropOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-dashed border-series bg-zinc-900/80 px-8 py-14 text-center shadow-2xl">
        <div className="flex size-14 items-center justify-center rounded-full bg-series text-white">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.75"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight text-zinc-100">Suelta tu archivo GPX</p>
          <p className="mt-1 text-sm text-zinc-400">Se importará como una nueva salida</p>
        </div>
      </div>
    </div>
  )
}
