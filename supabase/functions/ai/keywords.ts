// keywords (ARCHITECTURE §5.7, memorization level L3): 3–6 words of a slide script, checked against
// the script. The app saves them in slides.keywords.
import type { AuthedUser } from '../_shared/auth.ts'
import { KEYWORDS_SCHEMA, type KeywordsResult, normalizeKeywords } from './contract.ts'
import { generateJson, type GeminiConfig } from './gemini.ts'
import { KEYWORDS_SYSTEM, keywordsPrompt } from './prompts/keywords.ts'
import { RequestError, stringField } from './request.ts'

/** A slide's script is a few hundred words; anything longer is cut. */
const MAX_SCRIPT_CHARS = 6000

export async function keywords(_user: AuthedUser, payload: unknown, gemini: GeminiConfig): Promise<KeywordsResult> {
  const script = stringField(payload, 'slide_script', MAX_SCRIPT_CHARS)
  if (!script) throw new RequestError('לשקף הזה אין תסריט.')
  const answer = await generateJson(gemini, {
    system: KEYWORDS_SYSTEM,
    parts: [{ text: keywordsPrompt(script) }],
    schema: KEYWORDS_SCHEMA,
    temperature: 0.2,
  })
  return { keywords: normalizeKeywords(answer, script) }
}
