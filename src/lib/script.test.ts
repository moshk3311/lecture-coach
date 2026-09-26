import { describe, expect, it } from 'vitest'
import { countWords, joinScript, planScriptSave, splitScript, type StoredSentence } from './script'

const texts = (text: string) => splitScript(text).map((s) => s.text)

describe('splitScript', () => {
  it('splits on sentence punctuation followed by a capital, quote or bracket', () => {
    expect(
      texts(
        'Walk the four blocks in one minute. Acidulation is chemistry (powders); granulation is physics. Tracephos is the 2024 add.',
      ),
    ).toEqual([
      'Walk the four blocks in one minute.',
      'Acidulation is chemistry (powders); granulation is physics.',
      'Tracephos is the 2024 add.',
    ])
    expect(texts('Is it cheap? No! "Quality" costs more… Right?')).toEqual(['Is it cheap?', 'No!', '"Quality" costs more…', 'Right?'])
    expect(texts('He said "stop." Then we left.')).toEqual(['He said "stop."', 'Then we left.'])
  })

  it('does not split abbreviations, initials, decimals or lowercase continuations', () => {
    expect(texts('Dr. Levi runs Plant 42 vs. Plant 50 today.')).toHaveLength(1)
    expect(texts('We use additives, e.g. Zinc and Boron, in the U.S. Army contract.')).toHaveLength(1)
    expect(texts('Ask J. Smith about it.')).toHaveLength(1)
    expect(texts('Output grew 2.5 times. approx. five lines run.')).toHaveLength(1)
    expect(texts('See page no. 5 for details.')).toHaveLength(1)
    expect(texts('Nameplate is ~1 million tonnes per year. Keep this slide to 20 seconds.')).toHaveLength(2)
  })

  it('treats every line as a paragraph and drops bullet glyphs', () => {
    expect(splitScript('First point. Still first.\n\n• Second point\n- Third point')).toEqual([
      { text: 'First point.', starts_paragraph: true },
      { text: 'Still first.', starts_paragraph: false },
      { text: 'Second point', starts_paragraph: true },
      { text: 'Third point', starts_paragraph: true },
    ])
    expect(splitScript('  \n \n')).toEqual([])
    expect(texts('-5 degrees at night')).toEqual(['-5 degrees at night'])
  })

  it('round-trips through joinScript', () => {
    const script = 'Good morning. Thanks for having me.\nToday: the plant.'
    expect(joinScript(splitScript(script))).toBe(script)
    expect(joinScript(splitScript('  Messy   spacing.  Here '))).toBe('Messy spacing. Here')
  })
})

describe('countWords', () => {
  it('counts words, contractions and numbers', () => {
    expect(countWords("We'll run 2 lines — it's 70 t/h.")).toBe(8)
    expect(countWords('')).toBe(0)
  })
})

describe('planScriptSave', () => {
  const stored: StoredSentence[] = [
    { id: 'a', text: 'Good morning everyone.', starts_paragraph: true },
    { id: 'b', text: 'Today we walk through the plant.', starts_paragraph: false },
    { id: 'c', text: 'It has two granulation lines.', starts_paragraph: false },
  ]
  const ids = (script: string) => planScriptSave(stored, splitScript(script)).map((s) => s.id)

  it('keeps every id when nothing changed', () => {
    expect(ids('Good morning everyone. Today we walk through the plant. It has two granulation lines.')).toEqual(['a', 'b', 'c'])
  })

  it('keeps ids around an inserted or deleted sentence', () => {
    expect(ids('Good morning everyone. Welcome to Rotem. Today we walk through the plant. It has two granulation lines.')).toEqual([
      'a',
      null,
      'b',
      'c',
    ])
    expect(ids('Good morning everyone. It has two granulation lines.')).toEqual(['a', 'c'])
  })

  it('keeps the id of a sentence edited in place, but not of one rewritten from scratch', () => {
    expect(ids('Good morning everyone. Today we walk through the whole plant. It has two granulation lines.')).toEqual(['a', 'b', 'c'])
    expect(ids('Good morning everyone. Safety comes first here. It has two granulation lines.')).toEqual(['a', null, 'c'])
  })

  it('carries paragraph starts and never reuses an id twice', () => {
    const drafts = planScriptSave(stored, splitScript('Good morning everyone.\nGood morning everyone. It has two granulation lines.'))
    expect(drafts.map((d) => [d.id, d.starts_paragraph])).toEqual([
      ['a', true],
      [null, true],
      ['c', false],
    ])
    const reused = drafts.map((d) => d.id).filter(Boolean)
    expect(new Set(reused).size).toBe(reused.length)
  })

  it('handles an empty side', () => {
    expect(planScriptSave([], splitScript('One. Two.')).map((d) => d.id)).toEqual([null, null])
    expect(planScriptSave(stored, [])).toEqual([])
  })
})
