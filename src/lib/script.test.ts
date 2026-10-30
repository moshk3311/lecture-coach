import { describe, expect, it } from 'vitest'
import {
  countWords,
  joinScript,
  mergeWithNext,
  moveSentence,
  planScriptSave,
  resegment,
  splitScript,
  splitSentence,
  toggleParagraph,
  type SentenceDraft,
  type StoredSentence,
} from './script'

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

describe('resegment', () => {
  const sentences = (...texts: string[]) => texts.map((text, i) => ({ text, starts_paragraph: i === 0 }))
  const resplit = (stored: string[], text: string) => resegment(sentences(...stored), text).map((s) => s.text)

  it('splits like splitScript when nothing was segmented by hand', () => {
    const text = 'One idea here. Another one.\n• A new paragraph'
    expect(resegment([], text)).toEqual(splitScript(text))
    expect(resegment(splitScript(text), text)).toEqual(splitScript(text))
  })

  it('keeps a merge made by hand, also after an edit elsewhere', () => {
    const stored = ['We will cover scale. And process.', 'Then quality.']
    expect(resplit(stored, 'We will cover scale. And process. Then quality.')).toEqual(stored)
    expect(resplit(stored, 'We will cover scale. And process. Then quality and safety.')).toEqual([
      'We will cover scale. And process.',
      'Then quality and safety.',
    ])
  })

  it('keeps a split made by hand', () => {
    const stored = ['We cover scale,', 'process and quality.', 'Then safety.']
    expect(resplit(stored, 'We cover scale, process and quality. Then safety.')).toEqual(stored)
  })

  it('re-splits a merged sentence once its text was edited', () => {
    expect(resplit(['Scale matters. Process too.'], 'Scale matters a lot. Process too.')).toEqual(['Scale matters a lot.', 'Process too.'])
  })

  it('ignores a stored sentence that is only part of a longer one', () => {
    expect(resplit(['We grew.'], 'Last year We grew. fast and the plant too.')).toEqual(['Last year We grew. fast and the plant too.'])
  })

  it('keeps paragraphs from the text', () => {
    expect(resegment(sentences('A one. B two.'), 'A one. B two.\nC three.')).toEqual([
      { text: 'A one. B two.', starts_paragraph: true },
      { text: 'C three.', starts_paragraph: true },
    ])
  })
})

describe('sentence editor', () => {
  const list: SentenceDraft[] = [
    { id: 'a', text: 'We will cover scale, process and quality.', starts_paragraph: true },
    { id: 'b', text: 'Then safety.', starts_paragraph: false },
    { id: 'c', text: 'Questions?', starts_paragraph: true },
  ]

  it('splits a sentence before a word; the first part keeps the id', () => {
    expect(splitSentence(list, 0, 4).slice(0, 2)).toEqual([
      { id: 'a', text: 'We will cover scale,', starts_paragraph: true },
      { id: null, text: 'process and quality.', starts_paragraph: false },
    ])
    expect(splitSentence(list, 0, 0)).toBe(list)
    expect(splitSentence(list, 1, 2)).toBe(list)
  })

  it('merges with the next sentence; the first keeps its id and paragraph', () => {
    expect(mergeWithNext(list, 0)).toEqual([
      { id: 'a', text: 'We will cover scale, process and quality. Then safety.', starts_paragraph: true },
      list[2],
    ])
    expect(mergeWithNext(list, 2)).toBe(list)
  })

  it('moves a sentence and keeps the first one opening a paragraph', () => {
    const moved = moveSentence(list, 1, -1)
    expect(moved.map((s) => s.id)).toEqual(['b', 'a', 'c'])
    expect(moved[0]!.starts_paragraph).toBe(true)
    expect(moveSentence(list, 0, -1)).toBe(list)
    expect(moveSentence(list, 2, 1)).toBe(list)
  })

  it('toggles a paragraph start, never on the first sentence', () => {
    expect(toggleParagraph(list, 1)[1]!.starts_paragraph).toBe(true)
    expect(toggleParagraph(list, 2)[2]!.starts_paragraph).toBe(false)
    expect(toggleParagraph(list, 0)).toBe(list)
  })

  it('round-trips an edited segmentation through joinScript and resegment', () => {
    const edited = mergeWithNext(splitSentence(list, 0, 4), 1)
    expect(resegment(edited, joinScript(edited))).toEqual(edited.map(({ text, starts_paragraph }) => ({ text, starts_paragraph })))
  })
})
