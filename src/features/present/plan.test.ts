import { describe, expect, it } from 'vitest'
import { MIN_SLIDE_SECONDS, planWindows, timerStatus } from './plan'

const slide = (words: number, plannedSeconds: number | null = null) => ({ words, plannedSeconds })

describe('planWindows', () => {
  it('estimates at 140 WPM without a target', () => {
    // 140 words = 60 s, 70 words = 30 s.
    expect(planWindows([slide(140), slide(70)], null)).toEqual([
      { start: 0, end: 60, manual: false },
      { start: 60, end: 90, manual: false },
    ])
  })

  it('scales the estimate to fill the target duration', () => {
    const windows = planWindows([slide(140), slide(70)], 180)
    expect(windows.map((w) => [w.start, w.end])).toEqual([
      [0, 120],
      [120, 180],
    ])
  })

  it('keeps manual slides and scales only the others', () => {
    const windows = planWindows([slide(140, 30), slide(140), slide(140)], 150)
    expect(windows.map((w) => [w.start, w.end, w.manual])).toEqual([
      [0, 30, true],
      [30, 90, false],
      [90, 150, false],
    ])
  })

  it('gives slides without a script a minimum before scaling', () => {
    const windows = planWindows([slide(0), slide(0)], null)
    expect(windows.at(-1)?.end).toBe(2 * MIN_SLIDE_SECONDS)
    // With a target, empty slides share it evenly.
    expect(planWindows([slide(0), slide(0), slide(0)], 90).map((w) => w.end)).toEqual([30, 60, 90])
  })

  it('does not scale when manual slides use up the target', () => {
    const windows = planWindows([slide(0, 120), slide(140)], 100)
    expect(windows.map((w) => w.end)).toEqual([120, 180])
  })

  it('rounds boundaries so the total lands exactly on the target', () => {
    const windows = planWindows([slide(10), slide(10), slide(10)], 100)
    expect(windows.map((w) => w.end)).toEqual([33, 67, 100])
    windows.slice(1).forEach((w, i) => expect(w.start).toBe(windows[i]!.end))
  })
})

describe('timerStatus', () => {
  const window = { start: 240, end: 360, manual: false }

  it('is idle until the timer starts', () => {
    expect(timerStatus(0, window, false)).toBe('idle')
  })

  it('is blue ahead of the window, green inside, amber for 15 s after, then red', () => {
    expect(timerStatus(200, window, true)).toBe('ahead')
    expect(timerStatus(240, window, true)).toBe('on-time')
    expect(timerStatus(360, window, true)).toBe('on-time')
    expect(timerStatus(375, window, true)).toBe('over')
    expect(timerStatus(376, window, true)).toBe('late')
  })
})
