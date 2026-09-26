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

// Fechas en la zona horaria del navegador, la misma con la que el backend agrupa por días.
// Un instante ("2026-09-24T06:30:00Z") se muestra en hora local; una fecha de calendario sin hora
// ("2026-09-01", inicio de semana o mes) es ese día tal cual, sin desplazarlo por la zona
const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const shortDateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
const monthFmt = new Intl.DateTimeFormat('es-ES', { month: 'short' })
const monthYearFmt = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
const monthNameFmt = new Intl.DateTimeFormat('es-ES', { month: 'long' })

const weekdayDateFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

function toDate(value) {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value)
}

export const formatDate = (iso) => dateFmt.format(toDate(iso))
export const formatWeekdayDate = (iso) => weekdayDateFmt.format(toDate(iso)).replaceAll('.', '')
export const formatShortDate = (iso) => shortDateFmt.format(toDate(iso))
export const formatMonth = (iso) => monthFmt.format(toDate(iso)).replace('.', '')
export const formatMonthYear = (iso) => monthYearFmt.format(toDate(iso))
export const formatMonthName = (iso) => monthNameFmt.format(toDate(iso))

// Fecha local de hoy en formato YYYY-MM-DD (para <input type="date">)
export function todayInput() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Tiempo transcurrido corto ("hace 5 min", "hace 3 d")
export function timeAgo(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.round(hours / 24)} d`
}
