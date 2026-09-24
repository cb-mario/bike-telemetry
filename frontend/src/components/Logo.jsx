export function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="8" cy="21" r="6" className="text-series" stroke="currentColor" />
        <circle cx="24" cy="21" r="6" className="text-series" stroke="currentColor" />
        <path d="M8 21l5-10h7l4 10M13 11l3 10h-8M18 7h4" className="text-ink" stroke="currentColor" />
      </svg>
      <span className="text-sm font-semibold tracking-tight">BikeTelemetry</span>
    </div>
  )
}
