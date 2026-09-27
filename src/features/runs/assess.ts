import { useMutation, useQueryClient } from '@tanstack/react-query'
import { parseWav } from '../../audio/wav'
import type { RunTiming } from '../../lib/metrics'
import { supabase } from '../../lib/supabase'
import { speech } from '../../providers'
import { runKeys, type Attempt } from './api'
import { assessmentPayload } from './assessmentPayload'

/** An assessment failure with a Hebrew message the UI can show as-is. */
export class AssessmentError extends Error {
  override name = 'AssessmentError'
}

/**
 * Scores a saved take with Azure continuous assessment and attaches the result
 * (scores, words, speech metrics) to the attempt. Safe to run again.
 */
export async function assessRun(attempt: Attempt, onProgress: (seconds: number) => void): Promise<void> {
  if (!attempt.audio_path) throw new AssessmentError('ההקלטה של החזרה הזו כבר לא שמורה.')
  const { data: file, error } = await supabase.storage.from('recordings').download(attempt.audio_path)
  if (error) throw new AssessmentError('לא הצלחתי להוריד את ההקלטה. בדוק את החיבור ונסה שוב.')
  const wav = parseWav(await file.arrayBuffer())
  const { segments } = await speech.assessContinuous({ pcm: wav.data, referenceText: attempt.reference_text ?? '', onProgress })
  if (!segments.length) throw new AssessmentError('Azure לא זיהה דיבור בהקלטה.')
  const payload = assessmentPayload(
    attempt.id,
    segments,
    attempt.metrics as unknown as RunTiming,
    attempt.reference_text ?? '',
    Number(attempt.duration_sec),
  )
  const saved = await supabase.rpc('save_attempt', { p: payload })
  if (saved.error) throw new AssessmentError('ההערכה הצליחה אבל השמירה נכשלה. נסה שוב.')
}

export function useAssessRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ attempt, onProgress }: { attempt: Attempt; onProgress: (seconds: number) => void }) =>
      assessRun(attempt, onProgress),
    onSettled: (_, __, { attempt }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: runKeys.detail(attempt.id) }),
        attempt.lecture_id ? queryClient.invalidateQueries({ queryKey: runKeys.lecture(attempt.lecture_id) }) : null,
      ]),
  })
}
