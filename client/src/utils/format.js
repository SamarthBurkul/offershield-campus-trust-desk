// The ONLY place the client formats dates, times and money (en-IN). A test fails if toLocale* is used elsewhere.
const LOCALE = 'en-IN'

const dateFormat = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})
const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
const moneyFormat = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const numberFormat = new Intl.NumberFormat(LOCALE)

const UNITS = [
  ['year', 365 * 86_400_000],
  ['month', 30 * 86_400_000],
  ['week', 7 * 86_400_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

const toDate = (value) => {
  if (value == null || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "12 Nov 2026" (or the fallback for a missing date). */
export function formatDate(value, fallback = '—') {
  const date = toDate(value)
  return date ? dateFormat.format(date) : fallback
}

/** "12 Nov 2026, 1:34 pm" */
export function formatDateTime(value, fallback = '—') {
  const date = toDate(value)
  return date ? dateTimeFormat.format(date) : fallback
}

/** "3 hours ago", "in 2 days", "just now". */
export function relativeTime(value, now = Date.now()) {
  const date = toDate(value)
  if (!date) return '—'
  const diff = date.getTime() - now
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return relativeFormat.format(Math.round(diff / ms), unit)
  }
  return 'just now'
}

/** "₹22,543" with Indian digit grouping. */
export function formatMoney(value) {
  return moneyFormat.format(Number(value ?? 0))
}

/** Plain number with Indian grouping ("1,23,456"). */
export function formatNumber(value) {
  return numberFormat.format(Number(value ?? 0))
}
