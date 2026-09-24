import { useEffect, useState } from 'react'
import { SPORT_TYPES } from '../lib/sportTypes'
import { DATE_FILTERS, DISTANCE_FILTERS, ELEVATION_FILTERS, EMPTY_FILTERS, hasActiveFilters } from '../lib/routeFilters'

function Select({ label, value, options, onChange }) {
  const active = value !== ''
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={`h-9 appearance-none rounded-lg border bg-zinc-900/70 py-0 pr-8 pl-3 text-xs font-medium backdrop-blur-md
          transition-all duration-200 hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-series/40 [color-scheme:dark]
          ${active ? 'border-zinc-600 text-zinc-100' : 'border-zinc-800 text-zinc-400'}`}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-zinc-500"
        fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
    </label>
  )
}

// Búsqueda (con retardo) + filtros en una sola fila
export function RouteFilters({ filters, onChange }) {
  const [text, setText] = useState(filters.q)
  const [prevQ, setPrevQ] = useState(filters.q)

  // Si la búsqueda cambia desde fuera (p. ej. "Limpiar"), se ajusta el texto durante el render
  if (filters.q !== prevQ) {
    setPrevQ(filters.q)
    setText(filters.q)
  }

  useEffect(() => {
    if (text === filters.q) return
    const id = setTimeout(() => onChange({ ...filters, q: text }), 300)
    return () => clearTimeout(id)
  }, [text, filters, onChange])

  const set = (key) => (value) => onChange({ ...filters, [key]: value })
  const hasFilters = hasActiveFilters(filters)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-56 flex-1 sm:max-w-xs">
        <span className="sr-only">Buscar por nombre</span>
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-zinc-500"
          fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar ruta…"
          className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900/70 pr-3 pl-9 text-sm text-zinc-100 backdrop-blur-md
            transition-all duration-200 placeholder:text-zinc-500 hover:border-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-series/40" />
      </label>
      <Select label="Distancia" value={filters.distance} options={DISTANCE_FILTERS} onChange={set('distance')} />
      <Select label="Desnivel" value={filters.elevation} options={ELEVATION_FILTERS} onChange={set('elevation')} />
      <Select label="Fecha" value={filters.date} options={DATE_FILTERS} onChange={set('date')} />
      <Select label="Tipo" value={filters.sportType}
        options={[{ value: '', label: 'Todos los tipos' }, ...SPORT_TYPES]} onChange={set('sportType')} />
      {hasFilters && (
        <button type="button" onClick={() => onChange(EMPTY_FILTERS)}
          className="h-9 rounded-lg px-3 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100">
          Limpiar
        </button>
      )}
    </div>
  )
}
