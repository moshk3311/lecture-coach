/** Seconds as m:ss (or h:mm:ss from an hour), for timers and planned windows. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = String(s % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
}

const shortDate = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' })

export function formatShortDate(iso: string): string {
  return shortDate.format(new Date(iso))
}

/** Parses "90", "1:30" or "1:02:05" into seconds; null for empty text, NaN when it is not a time. */
export function parseClock(text: string): number | null {
  const clean = text.trim()
  if (!clean) return null
  if (!/^\d+(:[0-5]?\d){0,2}$/.test(clean)) return Number.NaN
  return clean.split(':').reduce((total, part) => total * 60 + Number(part), 0)
}
