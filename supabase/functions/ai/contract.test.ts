import { describe, expect, it } from 'vitest'
import {
  type AmericanizeContext,
  type DraftContext,
  InvalidAnswer,
  MAX_CHANGES,
  normalizeAmericanize,
  normalizeDraft,   normalizeKeywords,
  normalizeRunReport,
  type RunReportContext,
} from './contract.ts'

const context: RunReportContext = {
  heardAudio: true,
  slideCount: 5,
  durationSec: 300,
  model: 'gemini-test',
  promptVersion: 'v-test',
  createdAt: '2026-10-01T12:00:00.000Z',
  catalogSlugs: ['pace-calm', 'pause-before-key', 'hook-real-story', 'close-with-the-line'],
  ruleSlugs: ['pace-calm'],
  assessed: false,
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
      tips: [],
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

const tip = (fields: Record<string, unknown> = {}) => ({
  slug: 'pace-calm',
  trigger: 'pace_fast',
  slide: 3,
  approx_start_sec: 61.26,
  said_en: 'and then we moved on very quickly',
  personal_he: 'בשקף 3 הקצב עלה.',
  example_en: null,
  title_he: null,
  body_he: null,
  ...fields,
})

describe('normalizeRunReport tips', () => {
  const tips = (items: unknown[], over: Partial<RunReportContext> = {}) =>
    normalizeRunReport(answer({ tips: items }), { ...context, ...over }).tips

  it('keeps an anchor of a rule tip and marks it as from the notebook', () => {
    expect(tips([tip()])).toEqual([{ ...tip(), from_notebook: true, approx_start_sec: 61.3 }])
  })

  it('drops a slug that is not in the catalog and repeats of a slug', () => {
    expect(tips([tip({ slug: 'made-up' }), tip(), tip()])).toHaveLength(1)
  })

  it('keeps at most 2 extra tips, after the anchors, only for what can be heard', () => {
    const extras = [
      tip({ slug: 'hook-real-story', trigger: 'no_hook' }),
      tip({ slug: 'close-with-the-line', trigger: 'weak_ending' }),
      tip({ slug: null, trigger: 'no_story', title_he: 'סיפור', body_he: 'ספר סיפור.', example_en: 'Meet Dana.' }),
    ]
    const out = tips([...extras, tip()]) ?? []
    expect(out.map((t) => t.slug)).toEqual(['pace-calm', 'hook-real-story', 'close-with-the-line'])
  })

  it('accepts the measured triggers as extras only for a take that was not assessed', () => {
    const extra = tip({ slug: 'pause-before-key', trigger: 'few_pauses' })
    expect(tips([extra])).toHaveLength(1)
    expect(tips([extra], { assessed: true })).toHaveLength(0)
    expect(tips([tip()], { assessed: true })).toHaveLength(1)
  })

  it('needs the recording for extras, and quotes nothing without it', () => {
    const extra = tip({ slug: 'hook-real-story', trigger: 'no_hook' })
    const out = tips([extra, tip()], { heardAudio: false }) ?? []
    expect(out.map((t) => t.slug)).toEqual(['pace-calm'])
    expect(out[0]).toMatchObject({ said_en: null, approx_start_sec: null })
  })

  it('gives a tip without a slug its own title and body, and never calls it the notebook\'s', () => {
    const own = tip({ slug: null, from_notebook: true, trigger: 'no_story', title_he: ' סיפור ', body_he: 'ספר סיפור.', example_en: 'Meet Dana.' })
    expect(tips([own])).toEqual([
      expect.objectContaining({ slug: null, from_notebook: false, title_he: 'סיפור', body_he: 'ספר סיפור.', example_en: 'Meet Dana.' }),
    ])
    expect(tips([tip({ slug: null, trigger: 'no_story' })])).toEqual([])
  })

  it('treats every tip as general when the catalog is empty', () => {
    const own = tip({ slug: null, trigger: 'no_story', title_he: 'סיפור', body_he: 'ספר סיפור.' })
    expect(tips([tip(), own], { catalogSlugs: [], ruleSlugs: [] })).toHaveLength(1)
  })

  it('drops unknown triggers, tips without a personal line, and nulls bad slides', () => {
    expect(tips([tip({ trigger: 'angry' }), tip({ personal_he: '  ' })])).toEqual([])
    expect(tips([tip({ slide: 99 })])?.[0]?.slide).toBeNull()
  })
})

describe('normalizeDraft', () => {
  const draftContext: DraftContext = { budgetSeconds: 60, sawImage: true, isLastSlide: false, model: 'gemini-test', promptVersion: 'v-test' }
  const draft = (fields: Record<string, unknown> = {}) => ({
    script_en: '  Here is the plant.   It makes fertilizer.\n\n\nWe run it day and night.  ',
    transition_line_en: ' Now, how does it work? ',
    notes_he: ' קיצרתי את הפתיחה. ',
    ...fields,
  })

  it('keeps one paragraph per line, counts the words and works out the speaking time', () => {
    expect(normalizeDraft(draft(), draftContext)).toEqual({
      script_en: 'Here is the plant. It makes fertilizer.\nWe run it day and night.',
      transition_line: 'Now, how does it work?',
      notes_he: 'קיצרתי את הפתיחה.',
      words: 13,
      estimated_seconds: 6,
      budget_seconds: 60,
      saw_image: true,
      model: 'gemini-test',
      prompt_version: 'v-test',
    })
  })

  it('gives the last slide no bridge sentence', () => {
    expect(normalizeDraft(draft(), { ...draftContext, isLastSlide: true }).transition_line).toBeNull()
  })

  it('drops an empty or Hebrew bridge sentence', () => {
    expect(normalizeDraft(draft({ transition_line_en: null }), draftContext).transition_line).toBeNull()
    expect(normalizeDraft(draft({ transition_line_en: 'עכשיו נעבור הלאה' }), draftContext).transition_line).toBeNull()
  })

  it('refuses an answer with no script or a script in Hebrew', () => {
    expect(() => normalizeDraft(draft({ script_en: '  \n ' }), draftContext)).toThrow(InvalidAnswer)
    expect(() => normalizeDraft(draft({ script_en: 'This is the plant. זה המפעל.' }), draftContext)).toThrow(InvalidAnswer)
    expect(() => normalizeDraft(null, draftContext)).toThrow(InvalidAnswer)
  })
})

describe('normalizeAmericanize', () => {
  const context: AmericanizeContext = {
    text: "It's worth to check the numbers.\nWe will open the computer.",
    transitionLine: 'Now we pass to the safety.',
    model: 'gemini-test',
    promptVersion: 'v-test',
  }
  const answer = (fields: Record<string, unknown> = {}) => ({
    text_en: "  It's worth checking the numbers.\n\nWe'll turn on the computer. ",
    transition_line_en: " Now let's move on to safety. ",
    changes: [
      { from: 'worth to check', to: 'worth checking', reason_he: 'אחרי worth בא ing.' },
      { from: 'open the computer', to: 'turn on the computer', reason_he: 'תרגום מילולי מעברית.' },
      { from: 'pass to the safety', to: 'move on to safety', reason_he: 'ניסוח טבעי יותר.' },
    ],
    ...fields,
  })

  it('keeps one paragraph per line and the changes that quote what was sent', () => {
    expect(normalizeAmericanize(answer(), context)).toEqual({
      text_en: "It's worth checking the numbers.\nWe'll turn on the computer.",
      transition_line: "Now let's move on to safety.",
      changes: answer().changes,
      model: 'gemini-test',
      prompt_version: 'v-test',
    })
  })

  it('drops changes that are not in the text, change nothing, repeat, or have no reason', () => {
    const changes = [
      { from: 'made-up words', to: 'other words', reason_he: 'סיבה.' },
      { from: 'the numbers', to: 'The Numbers', reason_he: 'אותו דבר.' },
      { from: 'worth to check', to: 'worth checking', reason_he: 'סיבה.' },
      { from: 'Worth  to check', to: 'worth checking', reason_he: 'שוב.' },
      { from: 'open the computer', to: 'turn on the computer', reason_he: ' ' },
    ]
    expect(normalizeAmericanize(answer({ changes }), context).changes).toEqual([changes[2]])
  })

  it('accepts a cut, where "to" is empty', () => {
    const changes = [{ from: 'the numbers', to: '', reason_he: 'מיותר.' }]
    expect(normalizeAmericanize(answer({ changes }), context).changes).toEqual(changes)
  })

  it('reports no changes when the text came back the same', () => {
    const same = answer({ text_en: context.text, transition_line_en: context.transitionLine })
    expect(normalizeAmericanize(same, context).changes).toEqual([])
  })

  it('keeps at most MAX_CHANGES changes', () => {
    const words = Array.from({ length: MAX_CHANGES + 3 }, (_, i) => `word${i}`)
    const changes = words.map((w) => ({ from: w, to: `${w}s`, reason_he: 'סיבה.' }))
    const many = normalizeAmericanize(answer({ changes }), { ...context, text: words.join(' ') })
    expect(many.changes).toHaveLength(MAX_CHANGES)
  })

  it('gives no bridge when none was sent and keeps the sent one when the answer has none in English', () => {
    expect(normalizeAmericanize(answer(), { ...context, transitionLine: null }).transition_line).toBeNull()
    expect(normalizeAmericanize(answer({ transition_line_en: null }), context).transition_line).toBe(context.transitionLine)
    expect(normalizeAmericanize(answer({ transition_line_en: 'עוברים לבטיחות' }), context).transition_line).toBe(context.transitionLine)
  })

  it('refuses an answer with no text or with Hebrew in it', () => {
    expect(() => normalizeAmericanize(answer({ text_en: ' ' }), context)).toThrow(InvalidAnswer)
    expect(() => normalizeAmericanize(answer({ text_en: 'We check. אנחנו בודקים.' }), context)).toThrow(InvalidAnswer)
    expect(() => normalizeAmericanize('nope', context)).toThrow(InvalidAnswer)
  })
})
