import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { encodeWav } from '../../audio/wav'
import type { Recording } from '../../audio/recorder'
import type { Tables } from '../../lib/database.types'
import type { RunTiming } from '../../lib/metrics'
import { recordingPath } from '../../lib/storagePaths'
import { supabase } from '../../lib/supabase'

export type Attempt = Tables<'attempts'>
export type WordResult = Tables<'word_results'>
export type RunMetrics = RunTiming & { speech?: SpeechMetrics }

/** What the assessment adds to a take's metrics (ARCHITECTURE §5.7 run report). */
export type SpeechMetrics = {
  wpm: number | null
  fillers: number
  fillersPerMinute: number
  pauses: { short: number; long: number; longestMs: number }
  coverage: { ratio: number; omitted: string[]; inserted: string[] }
  perSlide: { position: number; wpm: number | null; words: number }[]
  weakest: { word: string; accuracy: number }[]
}

export const runKeys = {
  lecture: (lectureId: string) => ['runs', 'lecture', lectureId] as const,
  detail: (id: string) => ['runs', id] as const,
  usage: ['runs', 'usage'] as const,
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
    onSuccess: (_, { lectureId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: runKeys.lecture(lectureId) }),
        queryClient.invalidateQueries({ queryKey: runKeys.usage }),
      ]),
  })
}

/** Full-run takes of a lecture, newest first. */
export function useLectureRuns(lectureId: string) {
  return useQuery({
    queryKey: runKeys.lecture(lectureId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attempts')
        .select('id, created_at, duration_sec, pron_score, accuracy, fluency, prosody, wpm, filler_count, metrics')
        .eq('lecture_id', lectureId)
        .eq('mode', 'full_run')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export type RunDetail = Attempt & { word_results: WordResult[] }

export function useRun(attemptId: string) {
  return useQuery({
    queryKey: runKeys.detail(attemptId),
    queryFn: async (): Promise<RunDetail | null> => {
      const { data, error } = await supabase
        .from('attempts')
        .select('*, word_results(*)')
        .eq('id', attemptId)
        .order('position', { referencedTable: 'word_results' })
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

export type MonthUsage = { minutes: number; cap: number }

/** Azure audio minutes used this month against the cap in settings (quota guard, §5.3). */
export function useMonthUsage() {
  return useQuery({
    queryKey: runKeys.usage,
    queryFn: async (): Promise<MonthUsage> => {
      const [usage, settings] = await Promise.all([
        supabase.from('v_month_usage').select('minutes').maybeSingle(),
        supabase.from('user_settings').select('azure_minutes_cap').maybeSingle(),
      ])
      if (usage.error) throw usage.error
      if (settings.error) throw settings.error
      return { minutes: Number(usage.data?.minutes ?? 0), cap: settings.data?.azure_minutes_cap ?? 300 }
    },
  })
}
