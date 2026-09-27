// Reading Azure pronunciation-assessment JSON: utterance scores (the Azure check, sentence mode) and,
// for full runs, the words, phonemes and combined scores of every continuous-mode segment.

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

// ---------------------------------------------------------------------------
// Continuous assessment (full runs): one JSON result per recognized segment.
// ---------------------------------------------------------------------------

/** Azure offsets and durations are 100-ns ticks. */
const TICKS_PER_MS = 10_000

export type PhonemeResult = { phoneme: string; accuracy: number | null; nbest: { phoneme: string; score: number }[] }

export type AssessedWord = {
  word: string
  offsetMs: number
  durationMs: number
  accuracy: number | null
  errorType: string
  phonemes: PhonemeResult[]
}

type Obj = Record<string, unknown>
const obj = (value: unknown): Obj => (value && typeof value === 'object' ? (value as Obj) : {})
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

function bestOf(segment: unknown): Obj {
  return obj(list(obj(segment).NBest)[0])
}

/** Every assessed word of every segment, in time order, with phoneme details. */
export function assessedWords(segments: unknown[]): AssessedWord[] {
  return segments
    .flatMap((segment) => list(bestOf(segment).Words))
    .map((raw) => {
      const w = obj(raw)
      const pa = obj(w.PronunciationAssessment)
      return {
        word: typeof w.Word === 'string' ? w.Word : '',
        offsetMs: (num(w.Offset) ?? 0) / TICKS_PER_MS,
        durationMs: (num(w.Duration) ?? 0) / TICKS_PER_MS,
        accuracy: num(pa.AccuracyScore),
        errorType: typeof pa.ErrorType === 'string' ? pa.ErrorType : 'None',
        phonemes: list(w.Phonemes).map((rawPhoneme) => {
          const p = obj(rawPhoneme)
          const ppa = obj(p.PronunciationAssessment)
          return {
            phoneme: typeof p.Phoneme === 'string' ? p.Phoneme : '',
            accuracy: num(ppa.AccuracyScore),
            nbest: list(ppa.NBestPhonemes).flatMap((rawNbest) => {
              const n = obj(rawNbest)
              const score = num(n.Score)
              return typeof n.Phoneme === 'string' && score !== null ? [{ phoneme: n.Phoneme, score }] : []
            }),
          }
        }),
      }
    })
    .filter((w) => w.word)
    .sort((a, b) => a.offsetMs - b.offsetMs)
}

/** Take-level scores: each segment's scores weighted by its duration. */
export function combinedScores(segments: unknown[]): UtteranceScores {
  const keys: [keyof UtteranceScores, string][] = [
    ['pron', 'PronScore'],
    ['accuracy', 'AccuracyScore'],
    ['fluency', 'FluencyScore'],
    ['completeness', 'CompletenessScore'],
    ['prosody', 'ProsodyScore'],
  ]
  const result: UtteranceScores = { pron: null, accuracy: null, fluency: null, completeness: null, prosody: null }
  for (const [key, azureKey] of keys) {
    let sum = 0
    let weight = 0
    for (const segment of segments) {
      const value = num(obj(bestOf(segment).PronunciationAssessment)[azureKey])
      const duration = num(obj(segment).Duration) ?? 1
      if (value === null) continue
      sum += value * duration
      weight += duration
    }
    result[key] = weight ? Math.round((sum / weight) * 10) / 10 : null
  }
  return result
}

/** The recognized text of all segments, joined. */
export function recognizedText(segments: unknown[]): string {
  return segments
    .map((segment) => {
      const s = obj(segment)
      return typeof s.DisplayText === 'string' ? s.DisplayText : String(bestOf(segment).Display ?? '')
    })
    .filter(Boolean)
    .join(' ')
}
