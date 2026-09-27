import {
  fillerCount,
  pauseStats,
  scriptCoverage,
  weakestWords,
  wordsOnSlide,
  wordsPerMinute,
  type RunTiming,
} from '../../lib/metrics'
import type { Json } from '../../lib/database.types'
import { assessedWords, combinedScores, recognizedText } from '../../speech/azureResult'
import type { RunMetrics, SpeechMetrics } from './api'

/** The save_attempt payload that attaches an assessment to a saved take. */
export function assessmentPayload(
  attemptId: string,
  segments: unknown[],
  timing: RunTiming,
  referenceText: string,
  durationSec: number,
) {
  const words = assessedWords(segments)
  const scores = combinedScores(segments)
  const text = recognizedText(segments)
  const said = words.map((w) => w.word)
  const scriptWords = referenceText.split(/\s+/).filter(Boolean)
  const fillers = fillerCount(said, scriptWords)
  const pauses = pauseStats(words)
  const speech: SpeechMetrics = {
    wpm: wordsPerMinute(words),
    fillers,
    fillersPerMinute: durationSec > 0 ? Math.round((fillers / (durationSec / 60)) * 10) / 10 : 0,
    pauses,
    coverage: scriptCoverage(scriptWords, said),
    perSlide: timing.slides.map((slide) => {
      const own = wordsOnSlide(words, timing.visits, slide.position)
      return { position: slide.position, wpm: wordsPerMinute(own), words: own.length }
    }),
    weakest: weakestWords(words),
  }
  const metrics: RunMetrics = { ...timing, speech }
  return {
    id: attemptId,
    recognized_text: text,
    pron_score: scores.pron,
    accuracy: scores.accuracy,
    fluency: scores.fluency,
    completeness: scores.completeness,
    prosody: scores.prosody,
    wpm: speech.wpm,
    filler_count: fillers,
    long_pause_count: pauses.long,
    metrics,
    // Parsed from Azure's JSON, so it is JSON.
    azure_raw: { segments: segments as Json[] },
    words: words.map((w) => ({
      word: w.word,
      accuracy: w.accuracy,
      error_type: w.errorType,
      offset_ms: Math.round(w.offsetMs),
      duration_ms: Math.round(w.durationMs),
      phonemes: w.phonemes,
    })),
  }
}
