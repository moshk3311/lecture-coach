// Planned time per slide (ARCHITECTURE §5.7): script words at 140 WPM, scaled so the talk fills the
// lecture's target duration; a slide's manual planned_seconds is kept as is.

export const PLAN_WPM = 140
/** Even a slide without a script takes a few seconds (a title, a picture, a pause). */
export const MIN_SLIDE_SECONDS = 10
/** Past the end of a window, the timer is amber for this long, then red. */
export const GRACE_SECONDS = 15

export type PlanInput = { words: number; plannedSeconds: number | null }
/** Seconds from the start of the talk; `start` of slide n is `end` of slide n-1. */
export type SlideWindow = { start: number; end: number; manual: boolean }

export function planWindows(slides: PlanInput[], targetSeconds: number | null): SlideWindow[] {
  const manual = slides.map((s) => s.plannedSeconds !== null && s.plannedSeconds > 0)
  const base = slides.map((s, i) =>
    manual[i] ? (s.plannedSeconds as number) : Math.max(MIN_SLIDE_SECONDS, (s.words * 60) / PLAN_WPM),
  )

  let durations = base
  if (targetSeconds && targetSeconds > 0) {
    const fixed = base.reduce((sum, d, i) => sum + (manual[i] ? d : 0), 0)
    const auto = base.reduce((sum, d, i) => sum + (manual[i] ? 0 : d), 0)
    const free = targetSeconds - fixed
    // When manual slides already use up the target, the others keep their estimate.
    if (free > 0 && auto > 0) durations = base.map((d, i) => (manual[i] ? d : (d * free) / auto))
  }

  // Round the boundaries, not each duration, so the rounding never drifts.
  const windows: SlideWindow[] = []
  let cumulative = 0
  let start = 0
  durations.forEach((d, i) => {
    cumulative += d
    const end = Math.round(cumulative)
    windows.push({ start, end, manual: manual[i]! })
    start = end
  })
  return windows
}

export type TimerStatus = 'idle' | 'ahead' | 'on-time' | 'over' | 'late'

/** Timer color for the current slide: blue ahead of its window, green inside, amber, then red. */
export function timerStatus(elapsedSeconds: number, window: SlideWindow | undefined, started: boolean): TimerStatus {
  if (!started || !window) return 'idle'
  if (elapsedSeconds < window.start) return 'ahead'
  if (elapsedSeconds <= window.end) return 'on-time'
  if (elapsedSeconds <= window.end + GRACE_SECONDS) return 'over'
  return 'late'
}
