import { aiFunctionProvider } from './ai/aiFunctionProvider'
import { geminiVoice } from './ai/geminiVoice'
import { azureSpeechProvider } from './azure/azureSpeechProvider'
import type { LlmProvider } from './llm'
import type { ReferenceVoice, SpeechProvider } from './speech'

/** The app's speech provider. To swap vendors, change this line (ARCHITECTURE §2). */
export const speech: SpeechProvider = azureSpeechProvider

/** The American model clip: Gemini TTS, so it works without Azure (ARCHITECTURE §5.2). */
export const referenceVoice: ReferenceVoice = geminiVoice

/** The app's language model: the `ai` Edge Function, which calls Gemini on the server. */
export const llm: LlmProvider = aiFunctionProvider

export type * from './speech'
export type * from './llm'
