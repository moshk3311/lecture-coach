// The facts of a take for the run_report prompt, read from the attempt row and its lecture.
// `metrics` is the app's RunMetrics (src/features/runs/api.ts) stored as JSON, so it is read field
// by field.
import { isObject, list, num, text } from './json.ts'
import type { CatalogEntry, RuleTip, RunReportInput, SlideFacts } from './prompts/runReport.ts'

export type AttemptRow = {
  id: string
  mode: string
  lecture_id: string | null
  reference_text: string | null
  audio_path: string | null
  duration_sec: number | string
  metrics: unknown
}

export type LectureRow = { title: string; audience: string | null; target_minutes: number | null }

export function reportInput(attempt: AttemptRow, lecture: LectureRow | null, withAudio: boolean, catalog: CatalogEntry[] = []): RunReportInput {
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
    script: attempt.reference_text ?? '',
    catalog,
    ruleTips: ruleTips(metrics.tips),
  }
}

/** The tips the app saved with the take (metrics.tips), read field by field. */
export function ruleTips(value: unknown): RuleTip[] {
  return list(value).flatMap((tip): RuleTip[] => {
    const slug = isObject(tip) ? text(tip.slug) : ''
    return isObject(tip) && slug
      ? [{ slug, trigger: text(tip.trigger) || null, evidence_he: text(tip.evidence_he) || null }]
      : []
  })
}

