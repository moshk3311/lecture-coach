import { describe, expect, it } from 'vitest'
import {
  buildRunTiming,
  fillerCount,
  pauseStats,
  scriptCoverage,
  slideVisits,
  timingStatus,
  weakestWords,
  wordsOnSlide,
  wordsPerMinute,
  type TimedWord,
} from './metrics'

const word = (w: string, offsetMs: number, durationMs = 300, accuracy: number | null = 90, errorType = 'None'): TimedWord => ({
  word: w,
  offsetMs,
  durationMs,
  accuracy,
  errorType,
})

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

describe('speech metrics', () => {
  // 11 words over 5 s → 132 WPM, with pauses of 0.7 s and 0.8 s.
  const words = [
    word('Good', 0),
    word('morning', 300),
    word('everyone', 1300),
    word('today', 1600),
    word('we', 1900),
    word('walk', 2200),
    word('through', 4500),
    word('the', 4700, 100),
    word('plant', 4800, 200, 55, 'Mispronunciation'),
    word('um', 3000, 200),
    word('granulation', 3300, 400, 40),
  ].sort((x, y) => x.offsetMs - y.offsetMs)

  it('computes words per minute from first start to last end', () => {
    expect(wordsPerMinute(words)).toBe(132)
    expect(wordsPerMinute([word('one', 0)])).toBeNull()
  })

  it('counts short and long pauses and the longest gap', () => {
    expect(pauseStats(words)).toEqual({ short: 2, long: 0, longestMs: 800 })
    expect(pauseStats([word('a', 0), word('b', 2500)])).toEqual({ short: 0, long: 1, longestMs: 2200 })
  })

  it('counts fillers, but not "like" or "you know" that the script contains', () => {
    expect(fillerCount(['so', 'um', 'we', 'like', 'uh', 'this', 'you', 'know'])).toBe(4)
    expect(fillerCount(['plants', 'like', 'this'], ['Plants', 'like', 'this'])).toBe(0)
  })

  it('finds the weakest distinct words, worst first', () => {
    expect(weakestWords(words)).toEqual([
      { word: 'granulation', accuracy: 40 },
      { word: 'plant', accuracy: 55 },
    ])
  })

  it('assigns words to the slide that was on screen', () => {
    const visits = [
      { position: 1, start: 0, end: 2 },
      { position: 2, start: 2, end: 6 },
    ]
    expect(wordsOnSlide(words, visits, 1).map((w) => w.word)).toEqual(['Good', 'morning', 'everyone', 'today', 'we'])
  })
})

describe('scriptCoverage', () => {
  it('reports the share of the script said, plus omitted and inserted words', () => {
    const script = 'Good morning everyone. Today we walk through the plant.'.split(' ')
    const said = ['good', 'morning', 'um', 'today', 'we', 'walk', 'through', 'plant']
    expect(scriptCoverage(script, said)).toEqual({ ratio: 0.78, omitted: ['everyone', 'the'], inserted: ['um'] })
  })

  it('handles an empty script', () => {
    expect(scriptCoverage([], [])).toEqual({ ratio: 1, omitted: [], inserted: [] })
  })
})
