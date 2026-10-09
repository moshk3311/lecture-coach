import { describe, expect, it } from 'vitest'
import { detectIssues, selectTips, type CatalogTip, type Issue, type TipFacts, type TipHistory, type TipTrigger } from './tips'

const history: TipHistory = { previousTakes: 2, previousTopTrigger: null, recentSlugs: [] }

const facts = (over: Partial<TipFacts> = {}): TipFacts => ({
  totalSeconds: 600,
  targetSeconds: 600,
  slides: [
    { position: 1, seconds: 40, plannedSeconds: 40, status: 'on-track' },
    { position: 2, seconds: 60, plannedSeconds: 60, status: 'on-track' },
  ],
  speech: null,
  prosody: null,
  ...over,
})

const speech = (over: Partial<NonNullable<TipFacts['speech']>> = {}): NonNullable<TipFacts['speech']> => ({
  wpm: 145,
  perSlide: [],
  fillersPerMinute: 0.5,
  longPauses: 0,
  coverage: 0.95,
  ...over,
})

const triggers = (f: TipFacts, h: TipHistory = history) => detectIssues(f, h).map((i) => i.trigger)

describe('detectIssues', () => {
  it('finds nothing in a clean, in-time take', () => {
    expect(triggers(facts({ speech: speech(), prosody: 80 }))).toEqual([])
  })

  it('flags overtime only past 10% of the target, with the times as evidence', () => {
    expect(triggers(facts({ totalSeconds: 655 }))).toEqual([])
    const [issue] = detectIssues(facts({ totalSeconds: 720 }), history)
    expect(issue).toMatchObject({ trigger: 'overtime' })
    expect(issue?.evidence_he).toContain('12:00')
    expect(issue?.evidence_he).toContain('10:00')
  })

  it('flags the slide that ran 15+ seconds past its window', () => {
    const slides = [
      { position: 1, seconds: 40, plannedSeconds: 40, status: 'on-track' },
      { position: 2, seconds: 100, plannedSeconds: 60, status: 'long' },
      { position: 3, seconds: 85, plannedSeconds: 60, status: 'long' },
    ]
    const issue = detectIssues(facts({ slides }), history).find((i) => i.trigger === 'slide_overrun')
    expect(issue?.slide).toBe(2)
    expect(detectIssues(facts({ slides: [{ position: 1, seconds: 70, plannedSeconds: 60, status: 'long' }] }), history).map((i) => i.trigger)).not.toContain('slide_overrun')
  })

  it('flags an opening slide over a minute', () => {
    const slides = [{ position: 1, seconds: 95, plannedSeconds: 95, status: 'on-track' }]
    expect(triggers(facts({ slides }))).toContain('long_intro')
  })

  it('flags a fast take, or fast on two slides, with the slides in the evidence', () => {
    expect(triggers(facts({ speech: speech({ wpm: 172 }) }))).toContain('pace_fast')
    const two = speech({ wpm: 150, perSlide: [{ position: 4, wpm: 170 }, { position: 6, wpm: 168 }, { position: 5, wpm: 140 }] })
    const issue = detectIssues(facts({ speech: two }), history).find((i) => i.trigger === 'pace_fast')
    expect(issue?.evidence_he).toContain('4, 6')
    const one = speech({ wpm: 150, perSlide: [{ position: 4, wpm: 170 }] })
    expect(triggers(facts({ speech: one }))).not.toContain('pace_fast')
  })

  it('flags a slow take', () => {
    expect(triggers(facts({ speech: speech({ wpm: 118 }) }))).toContain('pace_slow')
  })

  it('flags long pauses at one per two minutes, fillers at two per minute, low coverage under 85%', () => {
    expect(triggers(facts({ speech: speech({ longPauses: 4 }) }))).not.toContain('long_pauses')
    expect(triggers(facts({ speech: speech({ longPauses: 5 }) }))).toContain('long_pauses')
    expect(triggers(facts({ speech: speech({ fillersPerMinute: 2 }) }))).toContain('fillers')
    expect(triggers(facts({ speech: speech({ coverage: 0.8 }) }))).toContain('low_coverage')
  })

  it('flags a monotone take from the prosody score', () => {
    expect(triggers(facts({ prosody: 55 }))).toContain('monotone')
    expect(triggers(facts({ prosody: 60 }))).not.toContain('monotone')
  })

  it('reads no speech rules before the take is assessed', () => {
    expect(triggers(facts({ speech: null }))).toEqual([])
  })

  it('adds the history triggers', () => {
    const f = facts({ speech: speech({ fillersPerMinute: 3 }) })
    expect(triggers(f, { ...history, previousTopTrigger: 'fillers' })).toContain('repeat_issue')
    expect(triggers(f, { ...history, previousTopTrigger: 'pace_fast' })).not.toContain('repeat_issue')
    expect(triggers(facts(), { ...history, previousTakes: 0 })).toEqual(['first_run'])
  })

  it('adds many_issues from four measured issues', () => {
    const f = facts({
      totalSeconds: 800,
      speech: speech({ wpm: 175, fillersPerMinute: 4, coverage: 0.7 }),
    })
    expect(triggers(f)).toContain('many_issues')
  })

  it('ranks the most severe first', () => {
    const f = facts({ totalSeconds: 900, speech: speech({ fillersPerMinute: 2 }) })
    expect(triggers(f)[0]).toBe('overtime')
  })
})

const tip = (slug: string, triggers: string[], rotating = false): CatalogTip => ({ slug, triggers, rotating })

const catalog: CatalogTip[] = [
  tip('pace-calm', ['pace_fast']),
  tip('pause-before-key', ['few_pauses', 'pace_fast']),
  tip('fillers-to-silence', ['fillers']),
  tip('every-word-purpose', ['overtime']),
  tip('open-body', [], true),
  tip('real-smile', [], true),
]

const issue = (trigger: TipTrigger, severity = 0.5): Issue => ({ trigger, severity, evidence_he: `evidence ${trigger}`, slide: null })

describe('selectTips', () => {
  it('picks one tip per issue, most severe first, with its evidence', () => {
    const picked = selectTips([issue('fillers', 0.9), issue('overtime', 0.6)], catalog, [])
    expect(picked.slice(0, 2)).toEqual([
      { slug: 'fillers-to-silence', trigger: 'fillers', evidence_he: 'evidence fillers', slide: null },
      { slug: 'every-word-purpose', trigger: 'overtime', evidence_he: 'evidence overtime', slide: null },
    ])
  })

  it('keeps at most 3 tips', () => {
    const issues = [issue('fillers'), issue('overtime'), issue('pace_fast'), issue('few_pauses')]
    expect(selectTips(issues, catalog, [])).toHaveLength(3)
  })

  it('skips a tip shown recently when another fits, and uses it when none does', () => {
    expect(selectTips([issue('pace_fast')], catalog, ['pace-calm'])[0]?.slug).toBe('pause-before-key')
    expect(selectTips([issue('fillers')], catalog, ['fillers-to-silence'])[0]?.slug).toBe('fillers-to-silence')
  })

  it('never picks one tip twice', () => {
    const picked = selectTips([issue('pace_fast'), issue('few_pauses')], catalog, [])
    expect(new Set(picked.map((p) => p.slug)).size).toBe(picked.length)
  })

  it('skips an issue no tip answers and moves to the next', () => {
    const picked = selectTips([issue('and_heavy', 0.9), issue('fillers', 0.5)], catalog, [])
    expect(picked[0]?.slug).toBe('fillers-to-silence')
  })

  it('adds one rotating tip with no trigger when fewer than 3 are chosen, rotating away from recent ones', () => {
    const picked = selectTips([issue('fillers')], catalog, ['open-body'])
    expect(picked).toHaveLength(2)
    expect(picked[1]).toEqual({ slug: 'real-smile', trigger: null, evidence_he: null, slide: null })
  })

  it('shows only the rotating tip for a take without issues', () => {
    expect(selectTips([], catalog, [])).toEqual([{ slug: 'open-body', trigger: null, evidence_he: null, slide: null }])
  })

  it('returns nothing from an empty catalog', () => {
    expect(selectTips([issue('fillers')], [], [])).toEqual([])
  })
})
