import { useQuery, useQueryClient, useMutation, type QueryClient } from '@tanstack/react-query'
import { encodeWav } from '../../audio/wav'
import type { Recording } from '../../audio/recorder'
import type { Tables } from '../../lib/database.types'
import type { RunTiming } from '../../lib/metrics'
import { recordingPath } from '../../lib/storagePaths'
import { supabase } from '../../lib/supabase'
import { recordingsToPrune } from './retention'

export type Attempt = Tables<'attempts'>
/** A take's metrics: its timing (the coach tips are saved alongside, see savedTips in tipData.ts). */
export type RunMetrics = RunTiming

export const runKeys = {
  all: ['runs'] as const,
  lecture: (lectureId: string) => ['runs', 'lecture', lectureId] as const,
  detail: (id: string) => ['runs', id] as const,
}

/** Supabase free plan: 50 MB per upload; a 16 kHz mono WAV grows by 32 kB a second. */
export const MAX_TAKE_SECONDS = Math.floor((50 * 1024 * 1024 - 44) / 32_000) - 30

export type TakeInput = {
  attemptId: string
  userId: string
  lectureId: string
  recording: Recording
  referenceText: string
  timing: RunTiming
}

/** Uploads the take's audio, then saves the attempt (mode full_run) with its timing. */
export async function saveTake({ attemptId, userId, lectureId, recording, referenceText, timing }: TakeInput): Promise<string> {
  const path = recordingPath(userId, attemptId)
  const wav = new Blob([encodeWav(recording.pcm, recording.sampleRate)], { type: 'audio/wav' })
  const upload = await supabase.storage.from('recordings').upload(path, wav, { contentType: 'audio/wav', upsert: true })
  if (upload.error) throw upload.error
  const { error } = await supabase.rpc('save_attempt', {
    p: {
      id: attemptId,
      lecture_id: lectureId,
      mode: 'full_run',
      reference_text: referenceText,
      audio_path: path,
      duration_sec: Math.round(recording.durationSec * 10) / 10,
      metrics: timing,
    },
  })
  if (error) throw error
  return attemptId
}

export function useSaveTake() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveTake,
    onSuccess: (_, { lectureId }) => {
      pruneRecordingsInBackground(queryClient)
      return queryClient.invalidateQueries({ queryKey: runKeys.lecture(lectureId) })
    },
  })
}

/**
 * Deletes the recordings `recordingsToPrune` picks and clears their audio_path;
 * the attempts and their scores stay. Files go first, so if clearing the rows
 * fails, the next run finds the same takes and finishes the job.
 */
export async function pruneRecordings(): Promise<number> {
  const { data, error } = await supabase
    .from('attempts')
    .select('id, lecture_id, audio_path, created_at')
    .eq('mode', 'full_run')
    .not('audio_path', 'is', null)
  if (error) throw error
  const stale = recordingsToPrune(data)
  if (!stale.length) return 0
  const removed = await supabase.storage.from('recordings').remove(stale.map((take) => take.audio_path))
  if (removed.error) throw removed.error
  const cleared = await supabase
    .from('attempts')
    .update({ audio_path: null })
    .in('id', stale.map((take) => take.id))
  if (cleared.error) throw cleared.error
  return stale.length
}

/** Runs after a take is saved or a lecture is deleted; a failure only waits for the next run. */
export function pruneRecordingsInBackground(queryClient: QueryClient) {
  pruneRecordings()
    .then((count) => (count ? queryClient.invalidateQueries({ queryKey: runKeys.all }) : undefined))
    .catch(() => undefined)
}

/**
 * Deletes the uploaded audio of a take discarded after a failed save, unless the
 * attempt was saved after all (only the reply got lost).
 */
export async function discardTakeAudio(userId: string, attemptId: string): Promise<void> {
  const { data, error } = await supabase.from('attempts').select('id').eq('id', attemptId).maybeSingle()
  if (error || data) return
  await supabase.storage.from('recordings').remove([recordingPath(userId, attemptId)])
}

/** Full-run takes of a lecture, newest first. */
export function useLectureRuns(lectureId: string) {
  return useQuery({
    queryKey: runKeys.lecture(lectureId),
    enabled: lectureId !== '',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attempts')
        .select('id, created_at, duration_sec, audio_path, metrics')
        .eq('lecture_id', lectureId)
        .eq('mode', 'full_run')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export type RunDetail = Attempt

export function useRun(attemptId: string) {
  return useQuery({
    queryKey: runKeys.detail(attemptId),
    queryFn: async (): Promise<RunDetail | null> => {
      const { data, error } = await supabase
        .from('attempts')
        .select('*')
        .eq('id', attemptId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** A signed URL to play a take's recording (private bucket). */
export function useRecordingUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['recording-url', path],
    enabled: Boolean(path),
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('recordings').createSignedUrl(path!, 60 * 60)
      if (error) throw error
      return data.signedUrl
    },
  })
}
