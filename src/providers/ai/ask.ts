import { functionErrorMessage } from '../../lib/functionError'
import { supabase } from '../../lib/supabase'
import { LlmError } from '../llm'

/** Calls one action of the `ai` Edge Function (ARCHITECTURE §7). */
export async function ask<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('ai', { body: { action, payload } })
  if (error) throw new LlmError(await functionErrorMessage(error, 'שירות ה-AI החזיר שגיאה. נסה שוב בעוד רגע.'))
  if (data === null) throw new LlmError('שירות ה-AI לא החזיר תשובה.')
  return data
}
