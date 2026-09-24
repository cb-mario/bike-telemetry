// Selector de opciones tipo iOS (radiogroup accesible)
export function SegmentedControl({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/70 p-0.5 backdrop-blur-md">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all duration-200
              focus-visible:outline-2 focus-visible:outline-series
              ${selected ? 'bg-zinc-700/70 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-100'}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
