import { describe, expect, it } from 'vitest'
import { assessedWords, combinedScores, recognizedText, utteranceScores } from './azureResult'

// Trimmed from a real scripted-assessment response (Speech SDK, en-US, prosody on).
const SAMPLE = {
  Id: 'b0e4a7d1',
  RecognitionStatus: 'Success',
  Offset: 1_000_000,
  Duration: 19_300_000,
  DisplayText: 'Good morning.',
  SNR: 38.2,
  NBest: [
    {
      Confidence: 0.94,
      Lexical: 'good morning',
      Display: 'Good morning.',
      PronunciationAssessment: {
        AccuracyScore: 96,
        FluencyScore: 100,
        CompletenessScore: 100,
        PronScore: 97.2,
        ProsodyScore: 88.4,
      },
      Words: [
        {
          Word: 'good',
          Offset: 1_000_000,
          Duration: 3_100_000,
          PronunciationAssessment: { AccuracyScore: 100, ErrorType: 'None' },
        },
      ],
    },
  ],
}

describe('utteranceScores', () => {
  it('reads the five utterance scores from the best hypothesis', () => {
    expect(utteranceScores(SAMPLE)).toEqual({
      pron: 97.2,
      accuracy: 96,
      fluency: 100,
      completeness: 100,
      prosody: 88.4,
    })
  })

  it('reports prosody as null when Azure does not return it', () => {
    const noProsody = {
      NBest: [{ PronunciationAssessment: { AccuracyScore: 96, FluencyScore: 100, CompletenessScore: 100, PronScore: 97.2 } }],
    }
    expect(utteranceScores(noProsody).prosody).toBeNull()
    expect(utteranceScores(noProsody).pron).toBe(97.2)
  })

  it('returns all nulls for unexpected shapes instead of throwing', () => {
    const empty = { pron: null, accuracy: null, fluency: null, completeness: null, prosody: null }
    expect(utteranceScores(null)).toEqual(empty)
    expect(utteranceScores({ NBest: [] })).toEqual(empty)
    expect(utteranceScores({ NBest: [{ PronunciationAssessment: { PronScore: 'high' } }] })).toEqual(empty)
  })
})

// Two segments in the documented continuous-mode shape (enableMiscue is off there).
const SEGMENTS = [
  {
    DisplayText: 'Good morning.',
    Offset: 1_000_000,
    Duration: 10_000_000,
    NBest: [
      {
        PronunciationAssessment: { AccuracyScore: 90, FluencyScore: 80, CompletenessScore: 100, PronScore: 86, ProsodyScore: 70 },
        Words: [
          {
            Word: 'good',
            Offset: 1_000_000,
            Duration: 3_000_000,
            PronunciationAssessment: { AccuracyScore: 95, ErrorType: 'None' },
            Phonemes: [
              {
                Phoneme: 'ɡ',
                PronunciationAssessment: { AccuracyScore: 98, NBestPhonemes: [{ Phoneme: 'ɡ', Score: 98 }, { Phoneme: 'k', Score: 20 }] },
              },
            ],
          },
          { Word: 'morning', Offset: 4_500_000, Duration: 5_000_000, PronunciationAssessment: { AccuracyScore: 60, ErrorType: 'Mispronunciation' } },
        ],
      },
    ],
  },
  {
    DisplayText: 'Thanks.',
    Offset: 20_000_000,
    Duration: 30_000_000,
    NBest: [
      {
        PronunciationAssessment: { AccuracyScore: 70, FluencyScore: 100, CompletenessScore: 100, PronScore: 78 },
        Words: [{ Word: 'thanks', Offset: 21_000_000, Duration: 4_000_000, PronunciationAssessment: { AccuracyScore: 70, ErrorType: 'None' } }],
      },
    ],
  },
]

describe('assessedWords', () => {
  it('flattens segment words into milliseconds with phoneme details', () => {
    const words = assessedWords(SEGMENTS)
    expect(words.map((w) => [w.word, w.offsetMs, w.durationMs, w.accuracy, w.errorType])).toEqual([
      ['good', 100, 300, 95, 'None'],
      ['morning', 450, 500, 60, 'Mispronunciation'],
      ['thanks', 2100, 400, 70, 'None'],
    ])
    expect(words[0]?.phonemes).toEqual([{ phoneme: 'ɡ', accuracy: 98, nbest: [{ phoneme: 'ɡ', score: 98 }, { phoneme: 'k', score: 20 }] }])
  })

  it('ignores malformed input', () => {
    expect(assessedWords([null, { NBest: 'x' }, { NBest: [{ Words: [{}] }] }])).toEqual([])
  })
})

describe('combinedScores', () => {
  it('weights each segment by its duration and skips missing scores', () => {
    expect(combinedScores(SEGMENTS)).toEqual({ pron: 80, accuracy: 75, fluency: 95, completeness: 100, prosody: 70 })
  })
})

describe('recognizedText', () => {
  it('joins the segments', () => {
    expect(recognizedText(SEGMENTS)).toBe('Good morning. Thanks.')
  })
})
