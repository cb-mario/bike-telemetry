// Iconos de trazo (24×24, 1.75 px) para no depender de glifos Unicode
const ICONS = {
  close: 'M6 6l12 12M18 6 6 18',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  arrowLeft: 'M19 12H5m6-6-6 6 6 6',
  chevronRight: 'm9 6 6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  upload: 'M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  heartPulse: 'M19.5 12.6 12 20l-7.5-7.4A5 5 0 0 1 12 6a5 5 0 0 1 7.5 6.6ZM4 12h4l2-3 3 6 2-3h5',
  chart: 'M4 20h16M7 16v-5m5 5V6m5 10v-8',
  trendUp: 'm3 17 6-6 4 4 8-8M15 7h6v6',
  trendDown: 'm3 7 6 6 4-4 8 8M15 17h6v-6',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z',
}

export function Icon({ name, className = 'size-4', strokeWidth = 1.75 }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  )
}
