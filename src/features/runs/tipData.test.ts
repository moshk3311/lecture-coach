import { describe, expect, it } from 'vitest'
import type { Json } from '../../lib/database.types'
import type { ReportTip } from '../../providers'
import type { SelectedTip } from '../../lib/tips'
import { savedTips, tipCards, tipHistory, tipSources, type CoachTip } from './tipData'

const source = { speaker: 'A', title: 'T', event: 'E', url: 'https://www.youtube.com/watch?v=x' }

const coachTip = (slug: string, over: Partial<CoachTip> = {}): CoachTip => ({
  id: slug,
  user_id: 'u',
  slug,
  category: 'delivery',
  triggers: [],
  rotating: false,
  title_he: `title ${slug}`,
  body_he: `body ${slug}`,
  example_en: null,
  sources: [source],
  active: true,
  updated_at: '2026-10-06T10:00:00Z',
  ...over,
})

const catalog = [coachTip('pace-calm'), coachTip('open-body', { rotating: true }), coachTip('hook-real-story')]

const aiTip = (over: Partial<ReportTip> = {}): ReportTip => ({
  slug: 'pace-calm',
  from_notebook: true,
  trigger: 'pace_fast',
  slide: 3,
  approx_start_sec: 61,
  said_en: 'and then we moved on',
  personal_he: 'בשקף 3 הקצב עלה.',
  example_en: null,
  title_he: null,
  body_he: null,
  ...over,
})

const rule = (slug: string, trigger: SelectedTip['trigger'], evidence_he: string | null = 'evidence'): SelectedTip => ({ slug, trigger, evidence_he, slide: null })

describe('tipSources', () => {
  it('keeps complete entries with an https link', () => {
    expect(tipSources([source, { ...source, url: 'javascript:alert(1)' }, { speaker: 'B' }, 'x', null])).toEqual([source])
    expect(tipSources({})).toEqual([])
  })
})

describe('savedTips', () => {
  it('reads the tips saved in metrics and drops what is unreadable', () => {
    const metrics = {
      tips: [
        { slug: 'pace-calm', trigger: 'pace_fast', evidence_he: 'x', slide: 2 },
        { slug: 'open-body', trigger: 'bogus' },
        { trigger: 'fillers' },
        7,
      ],
    }
    expect(savedTips(metrics)).toEqual([
      { slug: 'pace-calm', trigger: 'pace_fast', evidence_he: 'x', slide: 2 },
      { slug: 'open-body', trigger: null, evidence_he: null, slide: null },
    ])
    expect(savedTips(null)).toEqual([])
    expect(savedTips({})).toEqual([])
  })
})

describe('tipHistory', () => {
  const take = (created_at: string, tips: Json[]) => ({ created_at, metrics: { tips } })

  it('counts the earlier takes, takes the top measured issue and the recent slugs from them', () => {
    const takes = [
      take('2026-10-05', [{ slug: 'a', trigger: 'first_run' }, { slug: 'b', trigger: 'fillers' }]),
      take('2026-10-04', [{ slug: 'c', trigger: 'pace_fast' }]),
      take('2026-10-07', [{ slug: 'later', trigger: 'overtime' }]),
    ]
    expect(tipHistory('2026-10-06', takes)).toEqual({ previousTakes: 2, previousTopTrigger: 'fillers', recentSlugs: ['a', 'b', 'c'] })
  })

  it('has no previous issue for a first take', () => {
    expect(tipHistory('2026-10-06', [])).toEqual({ previousTakes: 0, previousTopTrigger: null, recentSlugs: [] })
  })

  it('looks at the last 5 takes for tips to rotate away from', () => {
    const takes = Array.from({ length: 7 }, (_, i) => take(`2026-10-${20 - i}`, [{ slug: `s${i}`, trigger: 'fillers' }]))
    expect(tipHistory('2026-10-25', takes).recentSlugs).toEqual(['s0', 's1', 's2', 's3', 's4'])
  })
})

describe('tipCards', () => {
  it('shows the rule tips with their evidence and, without Gemini, no moment', () => {
    const cards = tipCards([rule('pace-calm', 'pace_fast', '172 מילים')], catalog, [])
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ key: 'pace-calm', origin: 'rule', evidence_he: '172 מילים', moment: null, title_he: 'title pace-calm' })
    expect(cards[0]?.sources).toEqual([source])
  })

  it('labels the rotating tip and skips a tip the catalog no longer has', () => {
    const cards = tipCards([rule('open-body', null, null), rule('gone', 'fillers')], catalog, [])
    expect(cards.map((c) => [c.key, c.origin])).toEqual([['open-body', 'rotating']])
  })

  it('attaches Gemini\'s anchor to its rule tip', () => {
    const [card] = tipCards([rule('pace-calm', 'pace_fast')], catalog, [aiTip()])
    expect(card?.moment).toEqual({ personal_he: 'בשקף 3 הקצב עלה.', said_en: 'and then we moved on', slide: 3, startSec: 61 })
  })

  it('adds what Gemini heard after the rule tips, and its own tips as general', () => {
    const own = aiTip({ slug: null, from_notebook: false, trigger: 'no_story', title_he: 'דמות', body_he: 'ספר על אדם.', example_en: 'Meet Dana.', said_en: null })
    const cards = tipCards([rule('pace-calm', 'pace_fast')], catalog, [aiTip(), aiTip({ slug: 'hook-real-story', trigger: 'no_hook' }), own])
    expect(cards.map((c) => [c.key, c.origin])).toEqual([
      ['pace-calm', 'rule'],
      ['hook-real-story', 'heard'],
      ['general-2', 'general'],
    ])
    expect(cards[2]).toMatchObject({ title_he: 'דמות', example_en: 'Meet Dana.', sources: [], category: null })
  })

  it('drops a Gemini tip whose slug the catalog does not have', () => {
    expect(tipCards([], catalog, [aiTip({ slug: 'unknown' })])).toEqual([])
  })

  it('shows Gemini\'s general tips even without a catalog', () => {
    const own = aiTip({ slug: null, from_notebook: false, title_he: 'דמות', body_he: 'ספר על אדם.' })
    expect(tipCards([], [], [own]).map((c) => c.origin)).toEqual(['general'])
  })
})
