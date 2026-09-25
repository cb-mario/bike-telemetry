import { useEffect, useState } from 'react'
import { cn } from 'cn'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SPORT_TYPES } from '../lib/sportTypes'
import { DATE_FILTERS, DISTANCE_FILTERS, ELEVATION_FILTERS, EMPTY_FILTERS, hasActiveFilters } from '../lib/routeFilters'

// Filtro desplegable (shadcn/Base UI). La opción "cualquiera" usa value null, que es como
// Base UI representa "sin selección"; hacia fuera se sigue usando '' como en EMPTY_FILTERS
function FilterSelect({ label, value, options, onChange }) {
  const items = options.map((o) => ({ label: o.label, value: o.value === '' ? null : o.value }))
  const active = value !== ''
  return (
    <Select items={items} value={active ? value : null} onValueChange={(v) => onChange(v ?? '')}>
      <SelectTrigger aria-label={label}
        className={cn('h-9 bg-zinc-900 text-xs font-medium hover:border-zinc-600 data-[size=default]:h-9',
          active ? 'border-zinc-600 text-zinc-100' : 'border-zinc-800 text-zinc-400')}>
        <SelectValue />
      </SelectTrigger>
      {/* Al menos tan ancho como el botón, pero crece para que ninguna opción se corte */}
      <SelectContent className="w-auto min-w-(--anchor-width)">
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value ?? 'any'} value={item.value}>{item.label}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
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
          className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900 pr-3 pl-9 text-sm text-zinc-100
            transition-colors duration-150 placeholder:text-zinc-500 hover:border-zinc-600 focus:border-brand-2/70 focus:outline-none focus:ring-2 focus:ring-brand-2/20" />
      </label>
      <FilterSelect label="Distancia" value={filters.distance} options={DISTANCE_FILTERS} onChange={set('distance')} />
      <FilterSelect label="Desnivel" value={filters.elevation} options={ELEVATION_FILTERS} onChange={set('elevation')} />
      <FilterSelect label="Fecha" value={filters.date} options={DATE_FILTERS} onChange={set('date')} />
      <FilterSelect label="Tipo" value={filters.sportType}
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
