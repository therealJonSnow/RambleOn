// Journal dates are local calendar dates (YYYY-MM-DD) that roll over at a
// configurable hour, so a passage written at 00:40 belongs to the day before.

export const DEFAULT_ROLLOVER_HOUR = 4

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseIsoDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function journalDateFor(at: Date, rolloverHour: number): string {
  const d = new Date(at)
  if (d.getHours() < rolloverHour) d.setDate(d.getDate() - 1)
  return toIsoDate(d)
}

export function addDays(date: string, days: number): string {
  const d = parseIsoDate(date)
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

// Past days lock once the day has rolled over, unless unlocked in Settings.
export function isDayEditable(date: string, today: string, unlockedDates: string[]): boolean {
  return date >= today || unlockedDates.includes(date)
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatWeekday(date: string): string {
  return parseIsoDate(date).toLocaleDateString('en-GB', { weekday: 'long' })
}

export function formatLongDate(date: string): string {
  return parseIsoDate(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
