// Reading Azure pronunciation-assessment JSON. Sprint 0 needs only the utterance scores
// (for the Azure check); the full typed parser (words, phonemes, miscues) grows here in Sprint 2.

export type UtteranceScores = {
  pron: number | null
  accuracy: number | null
  fluency: number | null
  completeness: number | null
  /** Missing when the region/locale does not support prosody assessment. */
  prosody: number | null
}

function score(source: Record<string, unknown>, key: string): number | null {
  const value = source[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Utterance-level scores from NBest[0].PronunciationAssessment. */
export function utteranceScores(raw: unknown): UtteranceScores {
  const nbest = (raw as { NBest?: unknown } | null)?.NBest
  const best = Array.isArray(nbest) ? (nbest[0] as { PronunciationAssessment?: unknown } | undefined) : undefined
  const assessment = (best?.PronunciationAssessment ?? {}) as Record<string, unknown>

  return {
    pron: score(assessment, 'PronScore'),
    accuracy: score(assessment, 'AccuracyScore'),
    fluency: score(assessment, 'FluencyScore'),
    completeness: score(assessment, 'CompletenessScore'),
    prosody: score(assessment, 'ProsodyScore'),
  }
}
