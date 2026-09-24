import { useEffect, useRef, useState } from 'react'

const reducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Anima un número desde el valor mostrado (0 al principio) hasta `target`, con desaceleración suave
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0))
  const shown = useRef(value)

  useEffect(() => {
    if (target == null || !Number.isFinite(target) || reducedMotion()) return
    const from = Number.isFinite(shown.current) ? shown.current : 0
    const start = performance.now()
    let frame
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const next = from + (target - from) * (1 - (1 - t) ** 3)
      shown.current = next
      setValue(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  if (target == null) return null
  return reducedMotion() ? target : value
}
