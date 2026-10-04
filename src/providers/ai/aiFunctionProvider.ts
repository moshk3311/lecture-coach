import type { LlmProvider, RunReportFeedback } from '../llm'
import { ask } from './ask'

export const aiFunctionProvider: LlmProvider = {
  async keywords({ slideScript }) {
    const { keywords } = await ask<{ keywords: string[] }>('keywords', { slide_script: slideScript })
    return keywords
  },
  runReport: ({ attemptId }) => ask<RunReportFeedback>('run_report', { attempt_id: attemptId }),
}
