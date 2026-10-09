// LlmProvider: the only door to the language model (ARCHITECTURE §2). The `ai` Edge Function
// implements it with Gemini and keeps the key on the server, so swapping Gemini for Claude happens
// there. The answer types come from the function's contract, the single source of truth.
import type { RunReportFeedback, ScriptDraft } from '../../supabase/functions/ai/contract.ts'

export type {
  Correction,
  CorrectionCategory,
  DeliveryTopic,
  Improvement,
  ReportTip,
  RunReportFeedback,
  ScriptDraft,
  Severity,
} from '../../supabase/functions/ai/contract.ts'

/** A language-model failure with a Hebrew message the UI can show as-is. */
export class LlmError extends Error {
  override name = 'LlmError'
}

export interface LlmProvider {
  /** 3–6 words of a slide script to keep at memorization level L3. */
  keywords(request: { slideScript: string }): Promise<string[]>
  /** A proposed script and bridge sentence for one slide; nothing is saved. `intent` overrides the slide's saved intent notes. */
  draftScript(request: { slideId: string; intent?: string }): Promise<ScriptDraft>
  /** Gemini's report on a saved take; the function also saves it in attempts.ai_feedback. */
  runReport(request: { attemptId: string }): Promise<RunReportFeedback>
}
