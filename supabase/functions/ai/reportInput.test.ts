import { describe, expect, it } from 'vitest'
import { type AttemptRow, reportInput } from './reportInput.ts'

const timing = {
  version: 1,
  totalSeconds: 95.4,
  targetSeconds: 720,
  visits: [
    { position: 1, start: 0, end: 42.3 },
    { position: 2, start: 42.3, end: 95.4 },
  ],
  slides: [
    { position: 1, title: 'Intro', seconds: 42.3, plannedSeconds: 50, status: 'on-track' },
    { position: 2, title: '', seconds: 53.1, plannedSeconds: 30, status: 'long' },
  ],
}

const attempt: AttemptRow = {
  id: '00000000-0000-4000-8000-000000000001',
  mode: 'full_run',
  lecture_id: '22222222-2222-4222-8222-222222222222',
  reference_text: 'Welcome everyone.',
  audio_path: 'u/a.wav',
  duration_sec: '95.4',
  metrics: timing,
  pron_score: null,
  accuracy: null,
  fluency: null,
  prosody: null,
}

describe('reportInput', () => {
  it('reads the take timing and the lecture', () => {
    expect(reportInput(attempt, { title: 'Fertilizer Plants', audience: 'Consultants', target_minutes: 10 }, true)).toEqual({
      title: 'Fertilizer Plants',
      audience: 'Consultants',
      targetSeconds: 720, // from the take: the plan when it was recorded
      durationSec: 95.4,
      withAudio: true,
      visits: timing.visits,
      slides: [
        { position: 1, title: 'Intro', seconds: 42.3, plannedSeconds: 50, status: 'on-track' },
        { position: 2, title: 'Slide 2', seconds: 53.1, plannedSeconds: 30, status: 'long' },
      ],
      speech: null,
      script: 'Welcome everyone.',
    })
  })

  it('copes with a deleted lecture and missing fields', () => {
    const input = reportInput({ ...attempt, metrics: { visits: [{ position: 1 }], slides: ['x'] }, reference_text: null }, null, false)
    expect(input).toMatchObject({ title: 'Untitled talk', audience: null, targetSeconds: null, visits: [], slides: [], script: '' })
  })

  it('passes the speech measurements and scores of an assessed take', () => {
    const assessed = {
      ...attempt,
      pron_score: 82.4,
      prosody: 71,
      metrics: {
        ...timing,
        speech: {
          wpm: 171,
          fillers: 6,
          fillersPerMinute: 1.2,
          pauses: { short: 12, long: 2, longestMs: 2400 },
          coverage: { ratio: 0.91, omitted: ['the', 'granulation'], inserted: ['um'] },
          perSlide: [{ position: 1, wpm: 171, words: 120 }, { position: 2, wpm: null, words: 0 }],
          weakest: [{ word: 'phosphate', accuracy: 41 }],
        },
      },
    }
    expect(reportInput(assessed, null, true).speech).toEqual({
      wpm: 171,
      perSlideWpm: [
        { position: 1, wpm: 171 },
        { position: 2, wpm: null },
      ],
      fillers: 6,
      fillersPerMinute: 1.2,
      longPauses: 2,
      longestPauseSec: 2.4,
      coverage: 0.91,
      omitted: ['the', 'granulation'],
      weakest: [{ word: 'phosphate', accuracy: 41 }],
      scores: { pronunciation: 82.4, accuracy: null, fluency: null, prosody: 71 },
    })
  })
})
