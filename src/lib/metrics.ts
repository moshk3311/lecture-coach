// Run metrics (ARCHITECTURE §5.3, §5.7). Timing comes from slide-change marks alone; speech metrics
// come from the assessed words once Azure has scored the take. All pure, all unit-tested.
import type { SlideWindow } from '../features/present/plan'

// ---------------------------------------------------------------------------
// Timing: where the time went, slide by slide
// ---------------------------------------------------------------------------

/** Slide `position` went on screen `atSec` seconds into the take. */
export type SlideMark = { position: number; atSec: number }
export type SlideVisit = { position: number; start: number; end: number }

export type TimingStatus = 'on-track' | 'long' | 'short' | 'skipped'

export type SlideTiming = {
  position: number
  title: string | null
  /** Time on the slide, summed over every visit. */
  seconds: number
  plannedSeconds: number
  windowStart: number
  windowEnd: number
  /** When the slide first went on screen, or null when it never did. */
  firstStart: number | null
  status: TimingStatus
}

export type RunTiming = {
  version: 1
  totalSeconds: number
  targetSeconds: number | null
  visits: SlideVisit[]
  slides: SlideTiming[]
}

/** Consecutive marks become visits; the last one runs to the end of the take. */
export function slideVisits(marks: SlideMark[], durationSec: number): SlideVisit[] {
  const sorted = [...marks].sort((a, b) => a.atSec - b.atSec)
  const visits: SlideVisit[] = []
  sorted.forEach((mark, i) => {
    const end = Math.min(durationSec, sorted[i + 1]?.atSec ?? durationSec)
    const start = Math.min(mark.atSec, end)
    if (end <= start) return
    const last = visits.at(-1)
    if (last && last.position === mark.position && last.end === start) last.end = end
    else visits.push({ position: mark.position, start, end })
  })
  return visits
}

/** On track within ±20% of the plan (at least ±10 s). */
export function timingStatus(seconds: number, plannedSeconds: number): TimingStatus {
  if (seconds <= 0) return 'skipped'
  const tolerance = Math.max(10, plannedSeconds * 0.2)
  if (seconds > plannedSeconds + tolerance) return 'long'
  if (seconds < plannedSeconds - tolerance) return 'short'
  return 'on-track'
}

export function buildRunTiming(
  marks: SlideMark[],
  durationSec: number,
  slides: { position: number; title: string | null }[],
  windows: SlideWindow[],
  targetSeconds: number | null,
): RunTiming {
  const visits = slideVisits(marks, durationSec)
  return {
    version: 1,
    totalSeconds: round1(durationSec),
    targetSeconds,
    visits: visits.map((v) => ({ position: v.position, start: round1(v.start), end: round1(v.end) })),
    slides: slides.map((slide, i) => {
      const own = visits.filter((v) => v.position === slide.position)
      const seconds = own.reduce((sum, v) => sum + (v.end - v.start), 0)
      const window = windows[i] ?? { start: 0, end: 0 }
      const plannedSeconds = window.end - window.start
      return {
        position: slide.position,
        title: slide.title,
        seconds: round1(seconds),
        plannedSeconds,
        windowStart: window.start,
        windowEnd: window.end,
        firstStart: own[0] ? round1(own[0].start) : null,
        status: timingStatus(seconds, plannedSeconds),
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// Speech: pace, pauses, fillers, script coverage (from assessed words)
// ---------------------------------------------------------------------------

export type TimedWord = {
  word: string
  offsetMs: number
  durationMs: number
  accuracy: number | null
  errorType: string
}

/** Target pace band for a talk (§5.7). */
export const WPM_BAND = { min: 130, max: 160 } as const
export const SHORT_PAUSE_MS = 500
export const LONG_PAUSE_MS = 1500

const FILLERS = new Set(['um', 'uh', 'er', 'ah', 'erm', 'hmm', 'like'])

export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[’]/g, "'").replace(/[^\p{L}\p{N}']+/gu, '')
}

function spoken(words: TimedWord[]): TimedWord[] {
  return words.filter((w) => w.errorType !== 'Omission' && w.durationMs > 0)
}

/** Words per minute from the first word's start to the last word's end. */
export function wordsPerMinute(words: TimedWord[]): number | null {
  const said = spoken(words)
  const first = said[0]
  const last = said.at(-1)
  if (!first || !last || said.length < 2) return null
  const minutes = (last.offsetMs + last.durationMs - first.offsetMs) / 60_000
  return minutes > 0 ? Math.round(said.length / minutes) : null
}

export type PauseStats = { short: number; long: number; longestMs: number }

/** Silences between consecutive words: short over 0.5 s, long over 1.5 s. */
export function pauseStats(words: TimedWord[]): PauseStats {
  const said = spoken(words)
  const stats: PauseStats = { short: 0, long: 0, longestMs: 0 }
  for (let i = 1; i < said.length; i++) {
    const gap = said[i]!.offsetMs - (said[i - 1]!.offsetMs + said[i - 1]!.durationMs)
    if (gap > LONG_PAUSE_MS) stats.long++
    else if (gap > SHORT_PAUSE_MS) stats.short++
    stats.longestMs = Math.max(stats.longestMs, Math.round(gap))
  }
  return stats
}

/** Fillers heard: um, uh, er, ah… plus "like" and "you know" when they are not in the script. */
export function fillerCount(recognized: string[], scriptWords: string[] = []): number {
  const script = new Set(scriptWords.map(normalizeWord))
  const words = recognized.map(normalizeWord).filter(Boolean)
  let count = 0
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!
    if (word === 'you' && words[i + 1] === 'know' && !(script.has('you') && script.has('know'))) {
      count++
      i++
    } else if (FILLERS.has(word) && !script.has(word)) count++
  }
  return count
}

export type Coverage = {
  /** Share of script words that were said, 0..1. */
  ratio: number
  omitted: string[]
  inserted: string[]
}

/**
 * Aligns what was said with the script (longest common subsequence of words). Continuous
 * assessment cannot report omissions and insertions itself (Appendix B), so they come from here.
 */
export function scriptCoverage(scriptWords: string[], recognized: string[]): Coverage {
  const a = scriptWords.map(normalizeWord).filter(Boolean)
  const b = recognized.map(normalizeWord).filter(Boolean)
  if (!a.length) return { ratio: b.length ? 0 : 1, omitted: [], inserted: b }
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }
  const omitted: string[] = []
  const inserted: string[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++
      j++
    } else if (j < b.length && (i >= a.length || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
      inserted.push(b[j++]!)
    } else {
      omitted.push(a[i++]!)
    }
  }
  return { ratio: round2((a.length - omitted.length) / a.length), omitted, inserted }
}

/** Words said while a slide was on screen (by word start time). */
export function wordsOnSlide(words: TimedWord[], visits: SlideVisit[], position: number): TimedWord[] {
  const own = visits.filter((v) => v.position === position)
  return words.filter((w) => own.some((v) => w.offsetMs / 1000 >= v.start && w.offsetMs / 1000 < v.end))
}

/** The lowest-scoring distinct words, worst first. */
export function weakestWords(words: TimedWord[], limit = 8): { word: string; accuracy: number }[] {
  const worst = new Map<string, number>()
  for (const w of words) {
    const key = normalizeWord(w.word)
    if (!key || w.accuracy === null || w.errorType === 'Insertion') continue
    worst.set(key, Math.min(worst.get(key) ?? Infinity, w.accuracy))
  }
  return [...worst]
    .filter(([, accuracy]) => accuracy < 85)
    .sort((x, y) => x[1] - y[1])
    .slice(0, limit)
    .map(([word, accuracy]) => ({ word, accuracy }))
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
