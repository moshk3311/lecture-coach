import { describe, expect, it } from 'vitest'
import type { RunTiming } from '../../lib/metrics'
import { assessmentPayload } from './assessmentPayload'

const word = (Word: string, startSec: number, AccuracyScore = 90, ErrorType = 'None') => ({
  Word,
  Offset: startSec * 10_000_000,
  Duration: 3_000_000,
  PronunciationAssessment: { AccuracyScore, ErrorType },
})

const segments = [
  {
    DisplayText: 'Good morning um everyone.',
    Duration: 30_000_000,
    NBest: [
      {
        PronunciationAssessment: { PronScore: 80, AccuracyScore: 75, FluencyScore: 90, CompletenessScore: 100, ProsodyScore: 70 },
        Words: [word('good', 0), word('morning', 0.4), word('um', 0.8), word('everyone', 1.2, 50, 'Mispronunciation')],
      },
    ],
  },
  {
    DisplayText: 'Plant.',
    Duration: 10_000_000,
    NBest: [{ PronunciationAssessment: { PronScore: 90, AccuracyScore: 95, FluencyScore: 100 }, Words: [word('plant', 10)] }],
  },
]

const timing: RunTiming = {
  version: 1,
  totalSeconds: 12,
  targetSeconds: null,
  visits: [
    { position: 1, start: 0, end: 5 },
    { position: 2, start: 5, end: 12 },
  ],
  slides: [
    { position: 1, title: 'Intro', seconds: 5, plannedSeconds: 10, windowStart: 0, windowEnd: 10, firstStart: 0, status: 'short' },
    { position: 2, title: 'Plant', seconds: 7, plannedSeconds: 10, windowStart: 10, windowEnd: 20, firstStart: 5, status: 'on-track' },
  ],
}

describe('assessmentPayload', () => {
  const payload = assessmentPayload('a1', segments, timing, 'Good morning everyone. The plant.', 12)

  it('attaches combined scores, recognized text and raw segments', () => {
    expect(payload).toMatchObject({
      id: 'a1',
      recognized_text: 'Good morning um everyone. Plant.',
      pron_score: 82.5,
      accuracy: 80,
      prosody: 70,
      filler_count: 1,
      azure_raw: { segments },
    })
    expect(payload.words).toHaveLength(5)
    expect(payload.words[3]).toMatchObject({ word: 'everyone', accuracy: 50, error_type: 'Mispronunciation', offset_ms: 1200, duration_ms: 300 })
  })

  it('keeps the timing and adds speech metrics per slide', () => {
    const { speech, slides } = payload.metrics
    expect(slides).toEqual(timing.slides)
    expect(speech?.coverage).toEqual({ ratio: 0.8, omitted: ['the'], inserted: ['um'] })
    expect(speech?.perSlide.map((s) => [s.position, s.words])).toEqual([
      [1, 4],
      [2, 1],
    ])
    expect(speech?.weakest).toEqual([{ word: 'everyone', accuracy: 50 }])
    expect(speech?.fillersPerMinute).toBe(5)
  })
})
