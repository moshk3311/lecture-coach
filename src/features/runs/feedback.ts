// Gemini's run report as the app shows it (ARCHITECTURE §5.7): the saved JSON, Hebrew labels, and
// where each correction sits in the recording.
import { anchorSpan, type PhraseSpan } from '../../lib/anchor'
import type { Correction, CorrectionCategory, DeliveryTopic, RunReportFeedback, Severity } from '../../providers'

/** The report saved in attempts.ai_feedback, when it is one this version of the app can show. */
export function savedRunReport(value: unknown): RunReportFeedback | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const report = value as Partial<RunReportFeedback>
  const lists = [report.strengths_he, report.improvements, report.corrections].every(Array.isArray)
  return report.version === 1 && typeof report.summary_he === 'string' && lists ? (report as RunReportFeedback) : null
}

export const CATEGORY_LABELS: Record<CorrectionCategory, string> = {
  phrasing: 'ניסוח',
  grammar: 'דקדוק',
  word_choice: 'בחירת מילים',
  pronunciation: 'הגייה',
  stress: 'הטעמה',
  intonation: 'אינטונציה',
}

export const SEVERITY_LABELS: Record<Severity, string> = { jarring: 'צורם', minor: 'קל' }

export const TOPIC_LABELS: Record<DeliveryTopic, string> = {
  tone: 'טון',
  energy: 'אנרגיה',
  clarity: 'בהירות',
  pace: 'קצב',
  structure: 'מבנה',
}

/** The span ▶ You plays: Gemini's estimate with a margin. Null when Gemini gave no time. */
export function correctionSpan(correction: Correction, durationSec: number): PhraseSpan | null {
  if (correction.approx_start_sec === null) return null
  return anchorSpan(
    { startSec: correction.approx_start_sec, endSec: correction.approx_end_sec ?? correction.approx_start_sec },
    durationSec * 1000,
  )
}
