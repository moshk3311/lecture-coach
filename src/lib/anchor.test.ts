import { describe, expect, it } from 'vitest'
import { anchorPhrase, similarity, type TimelineWord } from './anchor'

/** Words said one after another from `startMs`: 300 ms each, 100 ms apart. */
function timeline(text: string, startMs: number): TimelineWord[] {
  return text.split(' ').map((word, i) => ({ word, offsetMs: startMs + i * 400, durationMs: 300 }))
}

describe('anchorPhrase', () => {
  const words = timeline('So today we want to put AI into work for every team', 10_000)

  it('uses the Azure word times when the phrase is found near Gemini time', () => {
    // "to" starts at 11.6 s, "work" ends at 13.5 s; 150 ms of padding on each side.
    expect(anchorPhrase('to put AI into work', { startSec: 12, endSec: 13.5 }, words, 60_000)).toEqual({
      startMs: 11_450,
      endMs: 13_650,
      matched: true,
    })
  })

  it('matches what Azure heard when it differs a little from the quote', () => {
    const heard = timeline('and we put a eye to work now', 5_000)
    expect(anchorPhrase('put AI to work', { startSec: 5.5, endSec: 7 }, heard, 60_000)).toEqual({
      startMs: 5_650, // "put" starts at 5.8 s
      endMs: 7_850, // "work" ends at 7.7 s
      matched: true,
    })
  })

  it('picks the occurrence closest to Gemini time', () => {
    const twice = [...timeline('put it to work', 5_000), ...timeline('put it to work', 8_000)]
    expect(anchorPhrase('put it to work', { startSec: 8.1, endSec: 9.4 }, twice, 60_000)).toMatchObject({
      startMs: 7_850,
      matched: true,
    })
  })

  it('ignores matches more than 3 s away and falls back to Gemini times ± 0.5 s', () => {
    expect(anchorPhrase('put AI into work', { startSec: 30, endSec: 31.5 }, words, 60_000)).toEqual({
      startMs: 29_500,
      endMs: 32_000,
      matched: false,
    })
  })

  it('falls back to Gemini times when the take was not assessed', () => {
    expect(anchorPhrase('put AI into work', { startSec: 12, endSec: 13 }, [], 60_000)).toEqual({
      startMs: 11_500,
      endMs: 13_500,
      matched: false,
    })
  })

  it('keeps the span inside the recording', () => {
    expect(anchorPhrase('hello', { startSec: 0.2, endSec: 0.4 }, [], 1_000)).toEqual({ startMs: 0, endMs: 900, matched: false })
    expect(anchorPhrase('hello', { startSec: 9.8, endSec: 10.4 }, [], 10_000)).toEqual({
      startMs: 9_300,
      endMs: 10_000,
      matched: false,
    })
  })

  it('reads an end before the start as a point in time', () => {
    expect(anchorPhrase('hello', { startSec: 5, endSec: 4 }, [], 60_000)).toEqual({ startMs: 4_500, endMs: 5_500, matched: false })
  })

  it('has nothing to anchor to without valid times', () => {
    expect(anchorPhrase('hello', { startSec: Number.NaN, endSec: 1 }, words, 60_000)).toBeNull()
    expect(anchorPhrase('hello', { startSec: 1, endSec: 2 }, words, 0)).toBeNull()
  })
})

describe('similarity', () => {
  it('is 1 for equal strings and 0 for nothing in common', () => {
    expect(similarity('abc', 'abc')).toBe(1)
    expect(similarity('', '')).toBe(1)
    expect(similarity('abc', '')).toBe(0)
  })

  it('is 1 minus the edit distance over the longer length', () => {
    expect(similarity('kitten', 'sitting')).toBeCloseTo(1 - 3 / 7)
  })
})
