import { describe, expect, it } from 'vitest'
import { utteranceScores } from './azureResult'

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
