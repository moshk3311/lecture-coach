import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { isTokenFresh } from './tokenFreshness'

export type AzureToken = { token: string; region: string; expiresAt: string }

/** A speech-service failure with a Hebrew message the UI can show as-is. */
export class SpeechServiceError extends Error {
  override name = 'SpeechServiceError'
}

let cache: { value: AzureToken; fetchedAt: number } | null = null
let inflight: Promise<AzureToken> | null = null

/** Returns a valid Azure Speech token, fetching a new one from the azure-token function when needed. */
export function getAzureToken(): Promise<AzureToken> {
  if (cache && isTokenFresh(cache.fetchedAt, Date.now())) return Promise.resolve(cache.value)
  inflight ??= requestToken()
    .then((value) => {
      cache = { value, fetchedAt: Date.now() }
      return value
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function clearAzureToken(): void {
  cache = null
}

async function requestToken(): Promise<AzureToken> {
  const { data, error } = await supabase.functions.invoke<AzureToken>('azure-token', { method: 'GET' })
  if (error) throw new SpeechServiceError(await describeFunctionError(error))
  if (!data?.token || !data.region) throw new SpeechServiceError('השרת לא החזיר טוקן של Azure.')
  return data
}

async function describeFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await (error.context as Response).json()) as { message_he?: string }
      if (body.message_he) return body.message_he
    } catch {
      // not JSON
    }
    return 'השרת החזיר שגיאה בבקשת טוקן.'
  }
  if (error instanceof FunctionsFetchError) return 'אין חיבור לשרת. בדוק את האינטרנט ונסה שוב.'
  return 'בקשת הטוקן נכשלה.'
}
