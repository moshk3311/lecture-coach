// americanize (ARCHITECTURE §5.1, §7): a slide's script and bridge sentence revised to natural spoken
// American English, with the changes explained in Hebrew. Nothing is saved: the app shows the
// differences and the owner accepts them or not.
import type { AuthedUser } from '../_shared/auth.ts'
import { AMERICANIZE_SCHEMA, type AmericanizeResult, normalizeAmericanize } from './contract.ts'
import { generateJson, type GeminiConfig } from './gemini.ts'
import { PROMPT_VERSION } from './prompts/coach.ts'
import { AMERICANIZE_SYSTEM, americanizePrompt } from './prompts/americanize.ts'
import { RequestError, stringField } from './request.ts'

/** A slide's script is a few hundred words; anything longer is refused rather than cut mid-sentence. */
const MAX_TEXT_CHARS = 6000
const MAX_BRIDGE_CHARS = 400

export async function americanize(_user: AuthedUser, payload: unknown, gemini: GeminiConfig): Promise<AmericanizeResult> {
  const script = stringField(payload, 'text', MAX_TEXT_CHARS + 1)
  if (!script) throw new RequestError('אין טקסט לתיקון.')
  if (script.length > MAX_TEXT_CHARS) throw new RequestError('התסריט ארוך מדי לתיקון בבת אחת.')
  const bridge = stringField(payload, 'transition_line', MAX_BRIDGE_CHARS) || null

  const answer = await generateJson(gemini, {
    system: AMERICANIZE_SYSTEM,
    parts: [{ text: americanizePrompt(script, bridge) }],
    schema: AMERICANIZE_SCHEMA,
    temperature: 0.2,
    thinking: 'low',
  })
  return normalizeAmericanize(answer, { text: script, transitionLine: bridge, model: gemini.model, promptVersion: PROMPT_VERSION })
}
