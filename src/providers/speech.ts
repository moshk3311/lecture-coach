// SpeechProvider: the only door to speech services (ARCHITECTURE §2). Azure implements it today;
// a self-hosted scorer could replace it later without touching the UI.

/** Word timing from TTS word-boundary events, in milliseconds. */
export type WordTiming = { word: string; offsetMs: number; durationMs: number }

export type SynthesisRequest = {
  text: string
  voice: string
  /** SSML prosody rate, e.g. "-25%" for the slow reference. */
  rate?: string
  /** mp3 for storage and playback; wav16k when the audio feeds an assessment. */
  format: 'mp3' | 'wav16k'
}

export type SynthesisResult = {
  audio: ArrayBuffer
  mimeType: string
  wordTimings: WordTiming[]
}

export type AssessmentRequest = {
  /** Raw PCM16, 16 kHz, mono, no WAV header. */
  pcm: ArrayBuffer
  referenceText: string
}

export type AssessmentResult = {
  recognizedText: string
  /** The provider's detailed JSON, kept whole for re-analysis (attempts.azure_raw). */
  raw: unknown
}

export interface SpeechProvider {
  synthesize(request: SynthesisRequest): Promise<SynthesisResult>
  /** Scripted pronunciation assessment of one short utterance (≤ 30 s). */
  assessOnce(request: AssessmentRequest): Promise<AssessmentResult>
}
