// Tarjeta modular: superficie sólida, borde fino y un filo de luz arriba
export function Card({ as: Tag = 'section', className = '', ...props }) {
  return (
    <Tag
      className={`min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_1px_2px_0_rgb(0_0_0/0.25)] ${className}`}
      {...props}
    />
  )
}

export function CardHeader({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-zinc-100">{title}</h2>
        {description && <p className="mt-1 text-xs text-zinc-400">{description}</p>}
      </div>
      {action}
    </div>
  )
}
