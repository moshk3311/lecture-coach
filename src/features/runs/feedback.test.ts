import { describe, expect, it } from 'vitest'
import type { Correction, RunReportFeedback } from '../../providers'
import { correctionSpan, savedRunReport } from './feedback'

const report: RunReportFeedback = {
  version: 1,
  model: 'gemini-test',
  prompt_version: 'v-test',
  created_at: '2026-10-01T12:00:00.000Z',
  heard_audio: true,
  summary_he: 'חזרה טובה.',
  strengths_he: [],
  improvements: [],
  next_session_plan_he: '',
  corrections: [],
}

const correction: Correction = {
  category: 'phrasing',
  severity: 'jarring',
  you_said_en: 'to put AI into work',
  american_en: 'put AI to work',
  principle_he: 'x',
  slide: 2,
  approx_start_sec: 12,
  approx_end_sec: 13.5,
}

describe('savedRunReport', () => {
  it('reads a saved report', () => {
    expect(savedRunReport(report)).toBe(report)
  })

  it('ignores anything else', () => {
    expect(savedRunReport(null)).toBeNull()
    expect(savedRunReport([report])).toBeNull()
    expect(savedRunReport({ ...report, version: 2 })).toBeNull()
    expect(savedRunReport({ ...report, corrections: null })).toBeNull()
    expect(savedRunReport({ ...report, summary_he: undefined })).toBeNull()
  })
})

describe('correctionSpan', () => {
  const words = ['to', 'put', 'AI', 'into', 'work'].map((word, i) => ({ word, offset_ms: 11_600 + i * 400, duration_ms: 300 }))

  it('anchors the quote to the assessed words', () => {
    expect(correctionSpan(correction, words, 60)).toEqual({ startMs: 11_450, endMs: 13_650, matched: true })
  })

  it('uses Gemini times when the take was not assessed or a word has no timing', () => {
    const untimed = words.map((w) => ({ ...w, offset_ms: null }))
    expect(correctionSpan(correction, untimed, 60)).toEqual({ startMs: 11_500, endMs: 14_000, matched: false })
  })

  it('has no span without a time', () => {
    expect(correctionSpan({ ...correction, approx_start_sec: null, approx_end_sec: null }, words, 60)).toBeNull()
  })

  it('reads a missing end as the start', () => {
    expect(correctionSpan({ ...correction, approx_end_sec: null }, [], 60)).toEqual({ startMs: 11_500, endMs: 12_500, matched: false })
  })
})
