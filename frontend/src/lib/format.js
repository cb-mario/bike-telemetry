const nf = (options) => new Intl.NumberFormat('es-ES', options)

const number0 = nf({ maximumFractionDigits: 0 })
const number1 = nf({ maximumFractionDigits: 1 })

export const formatNumber = (value, decimals = 0) =>
  value == null ? '—' : (decimals ? nf({ maximumFractionDigits: decimals }) : number0).format(value)

export const formatKm = (value) => (value == null ? '—' : `${number1.format(value)} km`)

// 510 → "8 h 30 min"
export function formatDuration(minutes) {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const shortDateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const monthFmt = new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'UTC' })
const monthYearFmt = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthNameFmt = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' })

const weekdayDateFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

export const formatDate = (iso) => dateFmt.format(new Date(iso))
export const formatWeekdayDate = (iso) => weekdayDateFmt.format(new Date(iso)).replaceAll('.', '')
export const formatShortDate = (iso) => shortDateFmt.format(new Date(iso))
export const formatMonth = (iso) => monthFmt.format(new Date(iso)).replace('.', '')
export const formatMonthYear = (iso) => monthYearFmt.format(new Date(iso))
export const formatMonthName = (iso) => monthNameFmt.format(new Date(iso))

// Fecha local de hoy en formato YYYY-MM-DD (para <input type="date">)
export function todayInput() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
