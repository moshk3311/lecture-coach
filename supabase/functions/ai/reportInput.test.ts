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
      script: 'Welcome everyone.',
      catalog: [],
      ruleTips: [],
    })
  })

  it('copes with a deleted lecture and missing fields', () => {
    const input = reportInput({ ...attempt, metrics: { visits: [{ position: 1 }], slides: ['x'] }, reference_text: null }, null, false)
    expect(input).toMatchObject({ title: 'Untitled talk', audience: null, targetSeconds: null, visits: [], slides: [], script: '' })
  })

  it('reads the tips saved with the take, field by field, and the catalog it is given', () => {
    const tips = [
      { slug: 'pace-calm', trigger: 'pace_fast', evidence_he: '172 מילים לדקה', slide: 4 },
      { slug: 'open-body', trigger: null, evidence_he: null, slide: null },
      { trigger: 'fillers' },
      'oops',
    ]
    const catalog = [{ slug: 'pace-calm', title_he: 'להאט', triggers: ['pace_fast'] }]
    const input = reportInput({ ...attempt, metrics: { ...timing, tips } }, null, true, catalog)
    expect(input.ruleTips).toEqual([
      { slug: 'pace-calm', trigger: 'pace_fast', evidence_he: '172 מילים לדקה' },
      { slug: 'open-body', trigger: null, evidence_he: null },
    ])
    expect(input.catalog).toEqual(catalog)
    expect(reportInput(attempt, null, true).ruleTips).toEqual([])
  })
})
