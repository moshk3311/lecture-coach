import type { ReferenceVoice } from '../speech'
import { ask } from './ask'

/** Gemini TTS through the `ai` function's `speak` action; the key stays on the server. */
export const geminiVoice: ReferenceVoice = {
  async speak({ text, voice }) {
    const { audio_base64, mime_type } = await ask<{ audio_base64: string; mime_type: string }>('speak', { text, voice })
    const bytes = Uint8Array.from(atob(audio_base64), (c) => c.charCodeAt(0))
    return { audio: bytes.buffer, mimeType: mime_type }
  },
}
