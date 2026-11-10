// Where a quoted phrase sits in a take (ARCHITECTURE §5.7, Corrections ▶ You). Gemini hears the
// take and gives approximate start/end times; the span played is those times with a small margin.

/** A playable span of the recording, in milliseconds. */
export type PhraseSpan = { startMs: number; endMs: number }

export const ESTIMATE_MARGIN_MS = 500

/**
 * The span for Gemini's estimate (in seconds) in a take of `durationMs`, widened by
 * ESTIMATE_MARGIN_MS and kept inside the take. Null without a valid estimate.
 */
export function anchorSpan(approx: { startSec: number; endSec: number }, durationMs: number): PhraseSpan | null {
  if (!Number.isFinite(approx.startSec) || !Number.isFinite(approx.endSec) || durationMs <= 0) return null
  const start = clamp(approx.startSec * 1000, 0, durationMs)
  const end = clamp(Math.max(approx.startSec, approx.endSec) * 1000, start, durationMs)
  return {
    startMs: clamp(start - ESTIMATE_MARGIN_MS, 0, durationMs),
    endMs: clamp(end + ESTIMATE_MARGIN_MS, 0, durationMs),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
