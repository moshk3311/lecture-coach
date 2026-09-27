// Storage object paths (ARCHITECTURE §6). Every object lives under {user_id}/ so the
// storage RLS policies can check ownership from the first folder name.

export function pptxPath(userId: string, lectureId: string): string {
  return `${userId}/${lectureId}.pptx`
}

export function slideImagesFolder(userId: string, lectureId: string): string {
  return `${userId}/${lectureId}`
}

/**
 * One rendered slide; `position` is the 1-based slide number. `version` changes on every render,
 * so a re-rendered slide never comes back from a stale CDN or browser cache.
 */
export function slideImagePath(
  userId: string,
  lectureId: string,
  position: number,
  version: string,
  ext: 'png' | 'webp',
): string {
  return `${slideImagesFolder(userId, lectureId)}/${position}-${version}.${ext}`
}

/** A take or sentence recording (16 kHz mono WAV). */
export function recordingPath(userId: string, attemptId: string): string {
  return `${userId}/${attemptId}.wav`
}
