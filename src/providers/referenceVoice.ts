// ReferenceVoice: the only door to the American model clip (ARCHITECTURE §2).

/** A phrase read in a reference voice (the American model clip). Gemini TTS implements it today. */
export interface ReferenceVoice {
  /** WAV audio of `text`; `voice` names one of the provider's voices. */
  speak(request: { text: string; voice: string }): Promise<{ audio: ArrayBuffer; mimeType: string }>
}
