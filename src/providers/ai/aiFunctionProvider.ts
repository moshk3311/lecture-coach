import type { LlmProvider, RunReportFeedback, ScriptDraft } from '../llm'
import { ask } from './ask'

export const aiFunctionProvider: LlmProvider = {
  async keywords({ slideScript }) {
    const { keywords } = await ask<{ keywords: string[] }>('keywords', { slide_script: slideScript })
    return keywords
  },
  draftScript: ({ slideId, intent }) => ask<ScriptDraft>('draft_script', { slide_id: slideId, ...(intent === undefined ? {} : { intent }) }),
  runReport: ({ attemptId }) => ask<RunReportFeedback>('run_report', { attempt_id: attemptId }),
}
