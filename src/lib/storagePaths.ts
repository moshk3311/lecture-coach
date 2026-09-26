// Storage object paths (ARCHITECTURE §6). Every object lives under {user_id}/ so the
// storage RLS policies can check ownership from the first folder name.

export function pptxPath(userId: string, lectureId: string): string {
  return `${userId}/${lectureId}.pptx`
}

export function slideImagesFolder(userId: string, lectureId: string): string {
  return `${userId}/${lectureId}`
}

/** One rendered slide; `position` is the 1-based slide number. */
export function slideImagePath(userId: string, lectureId: string, position: number, ext: 'png' | 'webp'): string {
  return `${slideImagesFolder(userId, lectureId)}/${position}.${ext}`
}
