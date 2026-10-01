import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'

/**
 * The Hebrew message for a failed Edge Function call: the function's own `message_he` when it sent
 * one, a connection message when the request never arrived, else `fallback`.
 */
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await (error.context as Response).json()) as { message_he?: string }
      if (body.message_he) return body.message_he
    } catch {
      // not JSON
    }
    return fallback
  }
  if (error instanceof FunctionsFetchError) return 'אין חיבור לשרת. בדוק את האינטרנט ונסה שוב.'
  return fallback
}
