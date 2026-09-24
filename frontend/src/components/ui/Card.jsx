export function Card({ className = '', ...props }) {
  return <section className={`min-w-0 rounded-xl border border-zinc-800 bg-surface ${className}`} {...props} />
}

export function CardHeader({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        {description && <p className="mt-1 text-xs text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
