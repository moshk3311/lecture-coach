import { describe, expect, it } from 'vitest'
import { memoTokens, nextMemoLevel, toMemoLevel, type MemoToken } from './memo'

/** Visible text with hidden letters as underscores. */
const render = (tokens: MemoToken[]) => tokens.map((t) => t.shown + '_'.repeat(t.hidden.length)).join('')

const LINE = "Thank you all for coming. Today we'll walk through the plant."

describe('memoTokens', () => {
  it('L0 shows the full text', () => {
    expect(render(memoTokens(LINE, 0))).toBe(LINE)
  })

  it('L1 blanks every third word and keeps punctuation', () => {
    expect(render(memoTokens(LINE, 1))).toBe("Thank you ___ for coming. _____ we'll walk _______ the plant.")
  })

  it('L2 keeps only first letters', () => {
    expect(render(memoTokens('Thank you all, Rotem-42.', 2))).toBe('T____ y__ a__, R____-4_.')
  })

  it('L3 keeps only the keywords', () => {
    expect(render(memoTokens('Granulation is physics, not chemistry.', 3, ['granulation', 'Physics']))).toBe(
      'Granulation __ physics, ___ _________.',
    )
  })

  it('L4 hides the script', () => {
    expect(memoTokens(LINE, 4)).toEqual([])
  })
})

describe('nextMemoLevel', () => {
  it('cycles and skips L3 without keywords', () => {
    expect([0, 1, 2, 4].map((l) => nextMemoLevel(toMemoLevel(l), false))).toEqual([1, 2, 4, 0])
    expect(nextMemoLevel(2, true)).toBe(3)
    expect(nextMemoLevel(3, true)).toBe(4)
  })

  it('reads unknown stored values as L0', () => {
    expect(toMemoLevel(7)).toBe(0)
    expect(toMemoLevel(2)).toBe(2)
  })
})
