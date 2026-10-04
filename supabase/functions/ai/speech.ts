// speak: a phrase in an American voice, made by Gemini TTS (ARCHITECTURE §5.2, §7). The function
// returns the WAV; the app caches it in Storage, so a phrase is synthesized once.
import type { AuthedUser } from '../_shared/auth.ts'
import { InvalidAnswer } from './contract.ts'
import { generateSpeech, type GeminiConfig } from './gemini.ts'
import { isObject, list } from './json.ts'
import { RequestError, stringField } from './request.ts'

/** A correction is a short phrase; this keeps one request well inside the free tier's per-minute budget. */
const MAX_TEXT_CHARS = 300

/** The prebuilt Gemini voices the app offers (the 30 studio voices are listed in the TTS docs). */
const VOICES = new Set(['Kore', 'Puck', 'Charon', 'Leda', 'Sulafat', 'Achird', 'Iapetus', 'Erinome'])
export const DEFAULT_VOICE = 'Kore'

/** How the phrase is read: a pronunciation coach's model, slow enough to imitate. */
export const SPEECH_STYLE = 'clear, neutral American English accent, slightly slow, as a pronunciation coach demonstrating a phrase'

export type SpeakResult = { audio_base64: string; mime_type: string }

export async function speak(_user: AuthedUser, payload: unknown, gemini: GeminiConfig): Promise<SpeakResult> {
  const text = stringField(payload, 'text', MAX_TEXT_CHARS)
  if (!text) throw new RequestError('אין טקסט להקראה.')
  const requested = stringField(payload, 'voice', 40)
  if (requested && !VOICES.has(requested)) throw new RequestError('הקול שנבחר לא נתמך.')
  return audioFromInteraction(await generateSpeech(gemini, { text, voice: requested || DEFAULT_VOICE, style: SPEECH_STYLE }))
}

/** The audio block of an Interactions API answer (steps → model_output → content → audio). */
export function audioFromInteraction(data: unknown): SpeakResult {
  const steps = isObject(data) ? list(data.steps) : []
  for (const step of steps.toReversed()) {
    if (!isObject(step) || step.type !== 'model_output') continue
    for (const block of list(step.content).toReversed()) {
      if (isObject(block) && block.type === 'audio' && typeof block.data === 'string' && block.data) {
        const mime = typeof block.mime_type === 'string' && block.mime_type ? block.mime_type : 'audio/wav'
        return { audio_base64: block.data, mime_type: mime }
      }
    }
  }
  throw new InvalidAnswer('the answer has no audio')
}
