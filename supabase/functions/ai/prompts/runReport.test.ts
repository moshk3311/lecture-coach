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
  script: 'Welcome everyone.',
  catalog: [
    { slug: 'pace-calm', title_he: 'להאט', triggers: ['pace_fast'] },
    { slug: 'open-body', title_he: 'גוף פתוח', triggers: [] },
  ],
  ruleTips: [{ slug: 'pace-calm', trigger: 'pace_fast', evidence_he: '172 מילים לדקה' }],
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

  it('lists the catalog and the rule tips with their measurements', () => {
    const prompt = runReportPrompt(input)
    expect(prompt).toContain('- pace-calm · pace_fast · להאט')
    expect(prompt).toContain('- open-body · no trigger · גוף פתוח')
    expect(prompt).toContain('- pace-calm · pace_fast · 172 מילים לדקה')
  })

  it('says so when there is no catalog and no rule tip', () => {
    const prompt = runReportPrompt({ ...input, catalog: [], ruleTips: [] })
    expect(prompt).toContain('(empty: use slug null for every tip)')
    expect(prompt).toContain('(none)')
  })
})
