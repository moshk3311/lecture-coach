// The facts of a take for the run_report prompt, read from the attempt row and its lecture.
// `metrics` is the app's RunMetrics (src/features/runs/api.ts) stored as JSON, so it is read field
// by field.
import { isObject, list, num, text } from './json.ts'
import type { RunReportInput, SlideFacts, SpeechFacts } from './prompts/runReport.ts'

export type AttemptRow = {
  id: string
  mode: string
  lecture_id: string | null
  reference_text: string | null
  audio_path: string | null
  duration_sec: number | string
  metrics: unknown
  pron_score: number | null
  accuracy: number | null
  fluency: number | null
  prosody: number | null
}

export type LectureRow = { title: string; audience: string | null; target_minutes: number | null }

export function reportInput(attempt: AttemptRow, lecture: LectureRow | null, withAudio: boolean): RunReportInput {
  const metrics = isObject(attempt.metrics) ? attempt.metrics : {}
  return {
    title: lecture?.title || 'Untitled talk',
    audience: lecture?.audience || null,
    targetSeconds: num(metrics.targetSeconds) ?? (lecture?.target_minutes ? lecture.target_minutes * 60 : null),
    durationSec: num(attempt.duration_sec) ?? num(metrics.totalSeconds) ?? 0,
    withAudio,
    visits: list(metrics.visits).flatMap((visit) => {
      if (!isObject(visit)) return []
      const [position, start, end] = [num(visit.position), num(visit.start), num(visit.end)]
      return position !== null && start !== null && end !== null ? [{ position, start, end }] : []
    }),
    slides: list(metrics.slides).flatMap((slide): SlideFacts[] => {
      const position = isObject(slide) ? num(slide.position) : null
      if (!isObject(slide) || position === null) return []
      return [
        {
          position,
          title: text(slide.title) || `Slide ${position}`,
          seconds: num(slide.seconds) ?? 0,
          plannedSeconds: num(slide.plannedSeconds) ?? 0,
          status: text(slide.status) || 'unknown',
        },
      ]
    }),
    speech: speechFacts(metrics.speech, attempt),
    script: attempt.reference_text ?? '',
  }
}

/** What the Azure assessment measured, or null when the take was not assessed. */
function speechFacts(speech: unknown, attempt: AttemptRow): SpeechFacts | null {
  if (!isObject(speech)) return null
  const pauses = isObject(speech.pauses) ? speech.pauses : {}
  const coverage = isObject(speech.coverage) ? speech.coverage : {}
  return {
    wpm: num(speech.wpm),
    perSlideWpm: list(speech.perSlide).flatMap((slide) => {
      const position = isObject(slide) ? num(slide.position) : null
      return isObject(slide) && position !== null ? [{ position, wpm: num(slide.wpm) }] : []
    }),
    fillers: num(speech.fillers) ?? 0,
    fillersPerMinute: num(speech.fillersPerMinute) ?? 0,
    longPauses: num(pauses.long) ?? 0,
    longestPauseSec: (num(pauses.longestMs) ?? 0) / 1000,
    coverage: num(coverage.ratio) ?? 0,
    omitted: list(coverage.omitted).map(text).filter(Boolean),
    weakest: list(speech.weakest).flatMap((word) => {
      const accuracy = isObject(word) ? num(word.accuracy) : null
      return isObject(word) && accuracy !== null && text(word.word) ? [{ word: text(word.word), accuracy }] : []
    }),
    scores: {
      pronunciation: num(attempt.pron_score),
      accuracy: num(attempt.accuracy),
      fluency: num(attempt.fluency),
      prosody: num(attempt.prosody),
    },
  }
}
