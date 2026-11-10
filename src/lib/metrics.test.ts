import { describe, expect, it } from 'vitest'
import { buildRunTiming, slideVisits, timingStatus } from './metrics'

describe('slideVisits', () => {
  it('turns marks into visits, merging repeats and ending at the take end', () => {
    expect(
      slideVisits(
        [
          { position: 1, atSec: 0 },
          { position: 2, atSec: 40 },
          { position: 2, atSec: 50 },
          { position: 1, atSec: 70 },
          { position: 3, atSec: 80 },
        ],
        100,
      ),
    ).toEqual([
      { position: 1, start: 0, end: 40 },
      { position: 2, start: 40, end: 70 },
      { position: 1, start: 70, end: 80 },
      { position: 3, start: 80, end: 100 },
    ])
  })

  it('drops zero-length visits (fast clicking)', () => {
    expect(slideVisits([{ position: 1, atSec: 0 }, { position: 2, atSec: 10 }, { position: 3, atSec: 10 }], 20)).toEqual([
      { position: 1, start: 0, end: 10 },
      { position: 3, start: 10, end: 20 },
    ])
  })
})

describe('timingStatus', () => {
  it('allows ±20% or ±10 s around the plan', () => {
    expect(timingStatus(60, 60)).toBe('on-track')
    expect(timingStatus(71, 60)).toBe('on-track')
    expect(timingStatus(73, 60)).toBe('long')
    expect(timingStatus(47, 60)).toBe('short')
    expect(timingStatus(125, 100)).toBe('long')
    expect(timingStatus(0, 60)).toBe('skipped')
  })
})

describe('buildRunTiming', () => {
  it('sums visits per slide and keeps the planned window', () => {
    const timing = buildRunTiming(
      [
        { position: 1, atSec: 0 },
        { position: 2, atSec: 50 },
        { position: 1, atSec: 70 },
      ],
      80,
      [
        { position: 1, title: 'Intro' },
        { position: 2, title: 'Plant' },
        { position: 3, title: 'End' },
      ],
      [
        { start: 0, end: 60, manual: false },
        { start: 60, end: 120, manual: false },
        { start: 120, end: 150, manual: false },
      ],
      150,
    )
    expect(timing.slides.map((s) => [s.position, s.seconds, s.plannedSeconds, s.firstStart, s.status])).toEqual([
      [1, 60, 60, 0, 'on-track'],
      [2, 20, 60, 50, 'short'],
      [3, 0, 30, null, 'skipped'],
    ])
    expect(timing.totalSeconds).toBe(80)
  })
})
