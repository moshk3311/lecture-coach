import { functionErrorMessage } from '../lib/functionError'
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
  if (error) throw new SpeechServiceError(await functionErrorMessage(error, 'השרת החזיר שגיאה בבקשת טוקן.'))
  if (!data?.token || !data.region) throw new SpeechServiceError('השרת לא החזיר טוקן של Azure.')
  return data
}
