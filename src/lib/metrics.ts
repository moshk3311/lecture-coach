// Run metrics (ARCHITECTURE §5.3, §5.7): timing comes from slide-change marks alone.
// All pure, all unit-tested.
import type { SlideWindow } from '../features/present/plan'

// ---------------------------------------------------------------------------
// Timing: where the time went, slide by slide
// ---------------------------------------------------------------------------

/** Slide `position` went on screen `atSec` seconds into the take. */
export type SlideMark = { position: number; atSec: number }
export type SlideVisit = { position: number; start: number; end: number }

export type TimingStatus = 'on-track' | 'long' | 'short' | 'skipped'

export type SlideTiming = {
  position: number
  title: string | null
  /** Time on the slide, summed over every visit. */
  seconds: number
  plannedSeconds: number
  windowStart: number
  windowEnd: number
  /** When the slide first went on screen, or null when it never did. */
  firstStart: number | null
  status: TimingStatus
}

export type RunTiming = {
  version: 1
  totalSeconds: number
  targetSeconds: number | null
  visits: SlideVisit[]
  slides: SlideTiming[]
}

/** Consecutive marks become visits; the last one runs to the end of the take. */
export function slideVisits(marks: SlideMark[], durationSec: number): SlideVisit[] {
  const sorted = [...marks].sort((a, b) => a.atSec - b.atSec)
  const visits: SlideVisit[] = []
  sorted.forEach((mark, i) => {
    const end = Math.min(durationSec, sorted[i + 1]?.atSec ?? durationSec)
    const start = Math.min(mark.atSec, end)
    if (end <= start) return
    const last = visits.at(-1)
    if (last && last.position === mark.position && last.end === start) last.end = end
    else visits.push({ position: mark.position, start, end })
  })
  return visits
}

/** On track within ±20% of the plan (at least ±10 s). */
export function timingStatus(seconds: number, plannedSeconds: number): TimingStatus {
  if (seconds <= 0) return 'skipped'
  const tolerance = Math.max(10, plannedSeconds * 0.2)
  if (seconds > plannedSeconds + tolerance) return 'long'
  if (seconds < plannedSeconds - tolerance) return 'short'
  return 'on-track'
}

export function buildRunTiming(
  marks: SlideMark[],
  durationSec: number,
  slides: { position: number; title: string | null }[],
  windows: SlideWindow[],
  targetSeconds: number | null,
): RunTiming {
  const visits = slideVisits(marks, durationSec)
  return {
    version: 1,
    totalSeconds: round1(durationSec),
    targetSeconds,
    visits: visits.map((v) => ({ position: v.position, start: round1(v.start), end: round1(v.end) })),
    slides: slides.map((slide, i) => {
      const own = visits.filter((v) => v.position === slide.position)
      const seconds = own.reduce((sum, v) => sum + (v.end - v.start), 0)
      const window = windows[i] ?? { start: 0, end: 0 }
      const plannedSeconds = window.end - window.start
      return {
        position: slide.position,
        title: slide.title,
        seconds: round1(seconds),
        plannedSeconds,
        windowStart: window.start,
        windowEnd: window.end,
        firstStart: own[0] ? round1(own[0].start) : null,
        status: timingStatus(seconds, plannedSeconds),
      }
    }),
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
