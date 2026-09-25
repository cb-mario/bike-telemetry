// Selector de opciones tipo iOS (radiogroup accesible)
export function SegmentedControl({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950/60 p-0.5">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-150
              focus-visible:outline-2 focus-visible:outline-brand-2
              ${selected ? 'bg-zinc-700 text-zinc-50 shadow-[0_1px_2px_0_rgb(0_0_0/0.35)]' : 'text-zinc-400 hover:text-zinc-100'}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
