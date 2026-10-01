import { describe, expect, it } from 'vitest'
import { InvalidAnswer, normalizeKeywords, normalizeRunReport, type RunReportContext } from './contract.ts'

const context: RunReportContext = {
  heardAudio: true,
  slideCount: 5,
  durationSec: 300,
  model: 'gemini-test',
  promptVersion: 'v-test',
  createdAt: '2026-10-01T12:00:00.000Z',
}

const correction = (fields: Record<string, unknown> = {}) => ({
  category: 'phrasing',
  severity: 'jarring',
  you_said_en: 'to put AI into work',
  american_en: 'put AI to work',
  principle_he: 'תרגום ישיר מערבב שני ביטויים.',
  slide: 2,
  approx_start_sec: 132.4,
  approx_end_sec: 134.1,
  ...fields,
})

const answer = (fields: Record<string, unknown> = {}) => ({
  summary_he: '  חזרה טובה,\n קצב יציב.  ',
  strengths_he: ['פתיחה ברורה'],
  improvements: [{ topic: 'energy', text_he: 'יותר אנרגיה בסיום', slide: 5 }],
  next_session_plan_he: 'לעצור לפני כל מספר.',
  corrections: [correction()],
  ...fields,
})

describe('normalizeRunReport', () => {
  it('keeps a well-formed answer and stamps model, prompt version and time', () => {
    expect(normalizeRunReport(answer(), context)).toEqual({
      version: 1,
      model: 'gemini-test',
      prompt_version: 'v-test',
      created_at: '2026-10-01T12:00:00.000Z',
      heard_audio: true,
      summary_he: 'חזרה טובה, קצב יציב.',
      strengths_he: ['פתיחה ברורה'],
      improvements: [{ topic: 'energy', text_he: 'יותר אנרגיה בסיום', slide: 5 }],
      next_session_plan_he: 'לעצור לפני כל מספר.',
      corrections: [correction()],
    })
  })

  it('drops unknown topics and categories and nulls slides that do not exist', () => {
    const report = normalizeRunReport(
      answer({
        improvements: [
          { topic: 'humor', text_he: 'x', slide: 1 },
          { topic: 'pace', text_he: 'לאט יותר', slide: 9 },
        ],
        corrections: [correction({ category: 'slang' }), correction({ slide: 0 })],
      }),
      context,
    )
    expect(report.improvements).toEqual([{ topic: 'pace', text_he: 'לאט יותר', slide: null }])
    expect(report.corrections).toHaveLength(1)
    expect(report.corrections[0]!.slide).toBeNull()
  })

  it('keeps times inside the take and reads a missing time as unknown', () => {
    const [late, reversed, missing] = normalizeRunReport(
      answer({
        corrections: [
          correction({ approx_start_sec: 299, approx_end_sec: 400 }),
          correction({ approx_start_sec: 50, approx_end_sec: 40 }),
          correction({ approx_start_sec: 'soon', approx_end_sec: null }),
        ],
      }),
      context,
    ).corrections
    expect([late!.approx_start_sec, late!.approx_end_sec]).toEqual([299, 300])
    expect([reversed!.approx_start_sec, reversed!.approx_end_sec]).toEqual([50, 50])
    expect([missing!.approx_start_sec, missing!.approx_end_sec]).toEqual([null, null])
  })

  it('drops a wording correction that changes nothing, but keeps sound corrections of the same words', () => {
    const { corrections } = normalizeRunReport(
      answer({
        corrections: [
          correction({ you_said_en: 'Put AI to work!', american_en: 'put AI to work' }),
          correction({ category: 'pronunciation', you_said_en: 'theory', american_en: 'theory' }),
        ],
      }),
      context,
    )
    expect(corrections.map((c) => c.category)).toEqual(['pronunciation'])
  })

  it('puts jarring corrections first and caps the lists', () => {
    const report = normalizeRunReport(
      answer({
        strengths_he: ['a', 'b', 'c', 'd'],
        corrections: [
          correction({ severity: 'minor', you_said_en: 'm1' }),
          ...Array.from({ length: 9 }, (_, i) => correction({ you_said_en: `j${i}` })),
        ],
      }),
      context,
    )
    expect(report.strengths_he).toEqual(['a', 'b', 'c'])
    expect(report.corrections).toHaveLength(8)
    expect(report.corrections.every((c) => c.severity === 'jarring')).toBe(true)
  })

  it('has no corrections when Gemini did not hear the recording', () => {
    expect(normalizeRunReport(answer(), { ...context, heardAudio: false }).corrections).toEqual([])
  })

  it('rejects an answer without a summary', () => {
    expect(() => normalizeRunReport(answer({ summary_he: '  ' }), context)).toThrow(InvalidAnswer)
    expect(() => normalizeRunReport('not json', context)).toThrow(InvalidAnswer)
  })
})

describe('normalizeKeywords', () => {
  const script = 'Our granulation line runs at 1,200 tons per day. Safety comes first, then throughput.'

  it('keeps distinct keywords that appear in the script', () => {
    expect(normalizeKeywords({ keywords: ['granulation line', 'Safety', 'safety', 'tons', 'throughput'] }, script)).toEqual([
      'granulation line',
      'Safety',
      'tons',
      'throughput',
    ])
  })

  it('drops keywords that are not in the script and keeps at most six', () => {
    expect(normalizeKeywords({ keywords: ['granulation', 'quality', 'Our', 'line', 'runs', 'day', 'first', 'then'] }, script)).toEqual([
      'granulation',
      'Our',
      'line',
      'runs',
      'day',
      'first',
    ])
  })

  it('rejects an answer with no usable keyword', () => {
    expect(() => normalizeKeywords({ keywords: ['quality'] }, script)).toThrow(InvalidAnswer)
    expect(() => normalizeKeywords(null, script)).toThrow(InvalidAnswer)
  })
})
