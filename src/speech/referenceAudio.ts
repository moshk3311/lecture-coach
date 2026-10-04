// Reference clips (ARCHITECTURE §5.2): Gemini TTS made by the `ai` function and cached in Storage, so a
// phrase is synthesized once. Corrections' ▶ American uses it; script sentences (Sprint 3) will too.
import { referenceAudioPath } from '../lib/storagePaths'
import { supabase } from '../lib/supabase'
import { referenceVoice } from '../providers'
import { referenceKey } from './referenceKey'

/** The voice every reference clip uses (a Gemini prebuilt voice); part of the cache key. */
export const REFERENCE_VOICE = 'Kore'

export type ReferenceClipRequest = { userId: string; text: string }

/** A signed URL of the clip; it is synthesized and uploaded first when it is not cached yet. */
export async function referenceClipUrl({ userId, text }: ReferenceClipRequest): Promise<string> {
  const bucket = supabase.storage.from('reference-audio')
  const path = referenceAudioPath(userId, await referenceKey(text, REFERENCE_VOICE))
  const cached = await bucket.exists(path)
  if (!cached.data) {
    const clip = await referenceVoice.speak({ text, voice: REFERENCE_VOICE })
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
