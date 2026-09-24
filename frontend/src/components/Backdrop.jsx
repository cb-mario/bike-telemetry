// Fondo vivo: tres halos azul/cian/índigo que se desplazan muy despacio detrás del contenido
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-[20%] left-[10%] size-[42rem] rounded-full bg-[#2563eb]/25 blur-[120px] animate-[aurora_26s_ease-in-out_infinite_alternate]" />
      <div className="absolute top-[30%] -right-[10%] size-[36rem] rounded-full bg-[#06b6d4]/15 blur-[120px] animate-[aurora_32s_ease-in-out_infinite_alternate-reverse]" />
      <div className="absolute -bottom-[25%] left-[30%] size-[40rem] rounded-full bg-[#6366f1]/15 blur-[130px] animate-[aurora_38s_ease-in-out_infinite_alternate]" />
      {/* Retícula muy tenue que da textura sin distraer */}
      <div className="absolute inset-0 bg-[linear-gradient(rgb(148_163_204/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(148_163_204/0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
    </div>
  )
}
