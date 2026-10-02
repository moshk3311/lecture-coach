// Reference clips (ARCHITECTURE §5.2): Azure TTS made in the browser and cached in Storage, so a
// phrase is synthesized once. Corrections' ▶ American uses it; script sentences (Sprint 3) will too.
import { referenceAudioPath } from '../lib/storagePaths'
import { supabase } from '../lib/supabase'
import { speech } from '../providers'
import { referenceKey } from './referenceKey'

export type ReferenceClipRequest = { userId: string; text: string; voice: string; rate?: string }

/** A signed URL of the clip; it is synthesized and uploaded first when it is not cached yet. */
export async function referenceClipUrl({ userId, text, voice, rate }: ReferenceClipRequest): Promise<string> {
  const bucket = supabase.storage.from('reference-audio')
  const path = referenceAudioPath(userId, await referenceKey(text, voice, rate))
  const cached = await bucket.exists(path)
  if (!cached.data) {
    const clip = await speech.synthesize({ text, voice, rate, format: 'mp3' })
    const upload = await bucket.upload(path, new Blob([clip.audio], { type: clip.mimeType }), {
      contentType: clip.mimeType,
      upsert: true,
    })
    if (upload.error) throw upload.error
  }
  const { data, error } = await bucket.createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}
