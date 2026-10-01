/**
 * Supabase free storage is 1 GB and a 20-minute take is about 38 MB, so only the
 * newest take recordings are kept; reports and scores stay (ARCHITECTURE §6).
 */
export const KEEP_RECORDINGS = 10

export type TakeAudio = { id: string; lecture_id: string | null; audio_path: string | null; created_at: string }

/**
 * Takes whose recording should be deleted: those beyond the newest `keep`, and
 * those of deleted lectures (their lecture_id is null), which no page shows.
 */
export function recordingsToPrune<T extends TakeAudio>(takes: T[], keep = KEEP_RECORDINGS): (T & { audio_path: string })[] {
  const withAudio = takes.filter((take): take is T & { audio_path: string } => take.audio_path !== null)
  const kept = new Set(
    withAudio
      .filter((take) => take.lecture_id !== null)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, keep)
      .map((take) => take.id),
  )
  return withAudio.filter((take) => !kept.has(take.id))
}
