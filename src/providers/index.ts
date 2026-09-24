import { azureSpeechProvider } from './azure/azureSpeechProvider'
import type { SpeechProvider } from './speech'

/** The app's speech provider. To swap vendors, change this line (ARCHITECTURE §2). */
export const speech: SpeechProvider = azureSpeechProvider

export type * from './speech'
