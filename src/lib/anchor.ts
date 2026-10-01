// Where a quoted phrase sits in a take (ARCHITECTURE §5.7, Corrections ▶ You). Gemini quotes the
// phrase with approximate times; Azure's word timeline is exact. The phrase is matched against the
// words within ±3 s of Gemini's times; without a good match, Gemini's times are used with a margin.
import { normalizeWord } from './metrics'

/** A word of the take's timeline (word_results), in milliseconds. */
export type TimelineWord = { word: string; offsetMs: number; durationMs: number }

/** A playable span of the recording. `matched` is true when it comes from Azure's words. */
export type PhraseSpan = { startMs: number; endMs: number; matched: boolean }

export const SEARCH_MS = 3000
export const MIN_SIMILARITY = 0.6
export const MATCH_PADDING_MS = 150
export const ESTIMATE_MARGIN_MS = 500

/**
 * The span of `phrase` in a take of `durationMs`. `approx` is Gemini's estimate in seconds; without
 * a valid estimate there is nothing to anchor to, so the result is null.
 */
export function anchorPhrase(
  phrase: string,
  approx: { startSec: number; endSec: number },
  words: TimelineWord[],
  durationMs: number,
): PhraseSpan | null {
  if (!Number.isFinite(approx.startSec) || !Number.isFinite(approx.endSec) || durationMs <= 0) return null
  const approxStart = clamp(approx.startSec * 1000, 0, durationMs)
  const approxEnd = clamp(Math.max(approx.startSec, approx.endSec) * 1000, approxStart, durationMs)

  const match = bestMatch(phrase, approxStart, approxEnd, words)
  if (match) {
    return {
      startMs: clamp(match.first.offsetMs - MATCH_PADDING_MS, 0, durationMs),
      endMs: clamp(match.last.offsetMs + match.last.durationMs + MATCH_PADDING_MS, 0, durationMs),
      matched: true,
    }
  }
  return {
    startMs: clamp(approxStart - ESTIMATE_MARGIN_MS, 0, durationMs),
    endMs: clamp(approxEnd + ESTIMATE_MARGIN_MS, 0, durationMs),
    matched: false,
  }
}

type Match = { first: TimelineWord; last: TimelineWord; score: number; distance: number }

/**
 * The run of spoken words near [startMs, endMs] that reads most like the phrase (a few words more
 * or fewer than the phrase), when it is similar enough. Ties go to the run closest to startMs.
 */
function bestMatch(phrase: string, startMs: number, endMs: number, words: TimelineWord[]): Match | null {
  const phraseWords = phrase.split(/\s+/).filter((w) => normalizeWord(w))
  const target = letters(phraseWords)
  if (!target) return null
  const near = words.filter(
    (w) => w.durationMs > 0 && w.offsetMs + w.durationMs >= startMs - SEARCH_MS && w.offsetMs <= endMs + SEARCH_MS,
  )

  let best: Match | null = null
  for (let i = 0; i < near.length; i++) {
    for (let size = Math.max(1, phraseWords.length - 2); size <= phraseWords.length + 2 && i + size <= near.length; size++) {
      const run = near.slice(i, i + size)
      const score = similarity(target, letters(run.map((w) => w.word)))
      const distance = Math.abs(run[0]!.offsetMs - startMs)
      if (score < MIN_SIMILARITY) continue
      if (!best || score > best.score || (score === best.score && distance < best.distance)) {
        best = { first: run[0]!, last: run.at(-1)!, score, distance }
      }
    }
  }
  return best
}

/** Letters and digits of the words, joined without spaces: "put AI to work" → "putaitowork". */
function letters(words: string[]): string {
  return words.map(normalizeWord).join('').replace(/'/g, '')
}

/** 1 for equal strings, 0 for nothing in common (normalized Levenshtein distance). */
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length)
  return longest ? 1 - levenshtein(a, b) / longest : 1
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous[b.length]!
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
