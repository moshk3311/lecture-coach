import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTakeSlice } from '../../audio/slice'
import type { PhraseSpan } from '../../lib/anchor'
import { llm } from '../../providers'
import { referenceClipUrl } from '../../speech/referenceAudio'
import { useAuth } from '../auth/useAuth'
import { DEFAULT_SETTINGS, useUserSettings } from '../settings/useUserSettings'
import { runKeys, useRecordingUrl } from './api'

/** Asks Gemini for the take's report; the function saves it, so the run is read again after. */
export function useRequestRunReport(attemptId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => llm.runReport({ attemptId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: runKeys.detail(attemptId) }),
  })
}

/**
 * ▶ You: the span of the take as a playable data URL; only its bytes are downloaded. A clip of a
 * few seconds is small, and a data URL needs no revoking.
 */
export function useTakeSlice(audioPath: string | null, span: PhraseSpan | null) {
  const { data: url } = useRecordingUrl(audioPath)
  return useQuery({
    queryKey: ['take-slice', audioPath, span?.startMs, span?.endMs],
    enabled: Boolean(url && span),
    staleTime: Infinity,
    queryFn: async () => dataUrl(await fetchTakeSlice(url!, span!.startMs, span!.endMs)),
  })
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('could not read the clip'))
    reader.readAsDataURL(blob)
  })
}

/** ▶ American: the phrase in the owner's reference voice (Azure TTS, cached in Storage). */
export function useReferenceClip(text: string) {
  const { session } = useAuth()
  const { data: settings } = useUserSettings()
  const userId = session?.user.id
  const voice = settings?.voice ?? DEFAULT_SETTINGS.voice
  return useQuery({
    queryKey: ['reference-clip', voice, text],
    enabled: Boolean(userId && text),
    staleTime: 50 * 60_000, // the signed URL lives an hour
    retry: false, // without Azure keys every try fails the same way
    queryFn: () => referenceClipUrl({ userId: userId!, text, voice }),
  })
}
