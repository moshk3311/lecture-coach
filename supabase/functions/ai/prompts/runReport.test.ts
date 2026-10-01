import { describe, expect, it } from 'vitest'
import { runReportPrompt, type RunReportInput } from './runReport.ts'

const input: RunReportInput = {
  title: 'Fertilizer Plants',
  audience: null,
  targetSeconds: 720,
  durationSec: 95.4,
  withAudio: true,
  visits: [
    { position: 1, start: 0, end: 42.3 },
    { position: 2, start: 42.3, end: 95.4 },
  ],
  slides: [
    { position: 1, title: 'Intro', seconds: 42.3, plannedSeconds: 50, status: 'on-track' },
    { position: 2, title: 'Agenda', seconds: 53.1, plannedSeconds: 30, status: 'long' },
  ],
  speech: null,
  script: 'Welcome everyone.',
}

describe('runReportPrompt', () => {
  it('states the talk, the take and whether the recording is attached', () => {
    const prompt = runReportPrompt(input)
    expect(prompt).toContain('Talk: "Fertilizer Plants" · audience: not given · target length: 12:00')
    expect(prompt).toContain('Take length: 1:35 (95 s). Recording attached: yes.')
    expect(runReportPrompt({ ...input, withAudio: false })).toContain('Recording attached: no.')
  })

  it('lists the slide timeline and the time per slide against the plan', () => {
    const prompt = runReportPrompt(input)
    expect(prompt).toContain('- slide 2 "Agenda": 42.3-95.4')
    expect(prompt).toContain('- slide 2 "Agenda": 0:53 vs 0:30 (long)')
  })

  it('says so when the take was not assessed', () => {
    expect(runReportPrompt(input)).toContain('Speech measurements: not available (the take was not assessed).')
  })

  it('passes the speech measurements of an assessed take', () => {
    const prompt = runReportPrompt({
      ...input,
      speech: {
        wpm: 171,
        perSlideWpm: [
          { position: 1, wpm: 150 },
          { position: 2, wpm: null },
        ],
        fillers: 6,
        fillersPerMinute: 1.2,
        longPauses: 2,
        longestPauseSec: 2.4,
        coverage: 0.91,
        omitted: ['the', 'granulation'],
        weakest: [{ word: 'phosphate', accuracy: 41.4 }],
        scores: { pronunciation: 82.4, accuracy: 79, fluency: null, prosody: 71 },
      },
    })
    expect(prompt).toContain('- pace: 171 words per minute (target band 130-160); per slide: 1: 150, 2: -')
    expect(prompt).toContain('- script coverage: 91% (omitted, for example: the, granulation)')
    expect(prompt).toContain('- scores out of 100: pronunciation 82, accuracy 79, prosody 71')
    expect(prompt).toContain('- weakest words: phosphate 41')
  })
})
