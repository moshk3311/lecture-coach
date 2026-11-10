import { aiFunctionProvider } from './ai/aiFunctionProvider'
import { geminiVoice } from './ai/geminiVoice'
import type { LlmProvider } from './llm'
import type { ReferenceVoice } from './referenceVoice'

/** The American model clip: Gemini TTS (ARCHITECTURE §5.2). */
export const referenceVoice: ReferenceVoice = geminiVoice

/** The app's language model: the `ai` Edge Function, which calls Gemini on the server. */
export const llm: LlmProvider = aiFunctionProvider

export type * from './referenceVoice'
export type * from './llm'
