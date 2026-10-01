import { aiFunctionProvider } from './ai/aiFunctionProvider'
import { azureSpeechProvider } from './azure/azureSpeechProvider'
import type { LlmProvider } from './llm'
import type { SpeechProvider } from './speech'

/** The app's speech provider. To swap vendors, change this line (ARCHITECTURE §2). */
export const speech: SpeechProvider = azureSpeechProvider

/** The app's language model: the `ai` Edge Function, which calls Gemini on the server. */
export const llm: LlmProvider = aiFunctionProvider

export type * from './speech'
export type * from './llm'
