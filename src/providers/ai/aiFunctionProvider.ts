import { functionErrorMessage } from '../../lib/functionError'
import { supabase } from '../../lib/supabase'
import { LlmError, type LlmProvider, type RunReportFeedback } from '../llm'

/** Calls one action of the `ai` Edge Function (ARCHITECTURE §7). */
async function ask<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('ai', { body: { action, payload } })
  if (error) throw new LlmError(await functionErrorMessage(error, 'שירות ה-AI החזיר שגיאה. נסה שוב בעוד רגע.'))
  if (data === null) throw new LlmError('שירות ה-AI לא החזיר תשובה.')
  return data
}

export const aiFunctionProvider: LlmProvider = {
  async keywords({ slideScript }) {
    const { keywords } = await ask<{ keywords: string[] }>('keywords', { slide_script: slideScript })
    return keywords
  },
  runReport: ({ attemptId }) => ask<RunReportFeedback>('run_report', { attempt_id: attemptId }),
}
