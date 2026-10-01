// The `ai` function's contract (ARCHITECTURE §7): what each action returns, the response schemas
// Gemini must follow, and the checks every answer passes before it is saved or returned.
// Pure (no Deno APIs): the app imports its types, and Vitest tests it.

export const CORRECTION_CATEGORIES = ['phrasing', 'grammar', 'word_choice', 'pronunciation', 'stress', 'intonation'] as const
export const SEVERITIES = ['jarring', 'minor'] as const
export const DELIVERY_TOPICS = ['tone', 'energy', 'clarity', 'pace', 'structure'] as const

export type CorrectionCategory = (typeof CORRECTION_CATEGORIES)[number]
export type Severity = (typeof SEVERITIES)[number]
export type DeliveryTopic = (typeof DELIVERY_TOPICS)[number]

/** Something in a take that sounds off to an American ear (§5.7 Corrections). */
export type Correction = {
  category: CorrectionCategory
  severity: Severity
  you_said_en: string
  american_en: string
  principle_he: string
  /** The slide on screen when it was said, or null. */
  slide: number | null
  /** Gemini's estimate of where it was said, in seconds into the take; null when it gave none. */
  approx_start_sec: number | null
  approx_end_sec: number | null
}

export type Improvement = { topic: DeliveryTopic; text_he: string; slide: number | null }

/** Gemini's report on a full-run take, saved in attempts.ai_feedback (§5.7 run report). */
export type RunReportFeedback = {
  version: 1
  model: string
  prompt_version: string
  created_at: string
  /** Gemini heard the recording; without it there are no corrections (§7). */
  heard_audio: boolean
  summary_he: string
  strengths_he: string[]
  improvements: Improvement[]
  next_session_plan_he: string
  corrections: Correction[]
}

export type KeywordsResult = { keywords: string[] }

export const MAX_STRENGTHS = 3
export const MAX_IMPROVEMENTS = 3
export const MAX_CORRECTIONS = 8
export const MAX_KEYWORDS = 6

// ---------------------------------------------------------------------------
// Response schemas (Gemini `responseSchema`, an OpenAPI subset)
// ---------------------------------------------------------------------------

const STRING = { type: 'STRING' }
const SLIDE = { type: 'INTEGER', nullable: true }

const CORRECTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    category: { type: 'STRING', enum: [...CORRECTION_CATEGORIES] },
    severity: { type: 'STRING', enum: [...SEVERITIES] },
    you_said_en: STRING,
    american_en: STRING,
    principle_he: STRING,
    slide: SLIDE,
    approx_start_sec: { type: 'NUMBER' },
    approx_end_sec: { type: 'NUMBER' },
  },
  required: ['category', 'severity', 'you_said_en', 'american_en', 'principle_he', 'slide', 'approx_start_sec', 'approx_end_sec'],
  propertyOrdering: ['category', 'severity', 'you_said_en', 'american_en', 'principle_he', 'slide', 'approx_start_sec', 'approx_end_sec'],
}

export const RUN_REPORT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary_he: STRING,
    strengths_he: { type: 'ARRAY', items: STRING, maxItems: MAX_STRENGTHS },
    improvements: {
      type: 'ARRAY',
      maxItems: MAX_IMPROVEMENTS,
      items: {
        type: 'OBJECT',
        properties: { topic: { type: 'STRING', enum: [...DELIVERY_TOPICS] }, text_he: STRING, slide: SLIDE },
        required: ['topic', 'text_he', 'slide'],
        propertyOrdering: ['topic', 'text_he', 'slide'],
      },
    },
    next_session_plan_he: STRING,
    corrections: { type: 'ARRAY', items: CORRECTION_SCHEMA, maxItems: MAX_CORRECTIONS },
  },
  required: ['summary_he', 'strengths_he', 'improvements', 'next_session_plan_he', 'corrections'],
  propertyOrdering: ['summary_he', 'strengths_he', 'improvements', 'next_session_plan_he', 'corrections'],
}

export const KEYWORDS_SCHEMA = {
  type: 'OBJECT',
  properties: { keywords: { type: 'ARRAY', items: STRING, minItems: 1, maxItems: MAX_KEYWORDS } },
  required: ['keywords'],
}

// ---------------------------------------------------------------------------
// Answer checks
// ---------------------------------------------------------------------------

/** Gemini answered, but not with something the app can use. */
export class InvalidAnswer extends Error {
  override name = 'InvalidAnswer'
}

export type RunReportContext = {
  heardAudio: boolean
  slideCount: number
  durationSec: number
  model: string
  promptVersion: string
  createdAt: string
}

/**
 * Keeps what the report can show: known topics and categories, slides that exist, times inside the
 * take, at most 3 strengths, 3 improvements and 8 corrections (jarring ones first). Corrections need
 * the audio, so a report without it has none.
 */
export function normalizeRunReport(raw: unknown, context: RunReportContext): RunReportFeedback {
  if (!isObject(raw)) throw new InvalidAnswer('run_report: the answer is not an object')
  const summary = text(raw.summary_he)
  if (!summary) throw new InvalidAnswer('run_report: the answer has no summary')

  const improvements = list(raw.improvements).flatMap((item): Improvement[] => {
    if (!isObject(item)) return []
    const topic = oneOf(DELIVERY_TOPICS, item.topic)
    const textHe = text(item.text_he)
    return topic && textHe ? [{ topic, text_he: textHe, slide: slideNumber(item.slide, context.slideCount) }] : []
  })

  const corrections = context.heardAudio
    ? list(raw.corrections)
        .flatMap((item) => correction(item, context))
        .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity))
    : []

  return {
    version: 1,
    model: context.model,
    prompt_version: context.promptVersion,
    created_at: context.createdAt,
    heard_audio: context.heardAudio,
    summary_he: summary,
    strengths_he: list(raw.strengths_he).map(text).filter(Boolean).slice(0, MAX_STRENGTHS),
    improvements: improvements.slice(0, MAX_IMPROVEMENTS),
    next_session_plan_he: text(raw.next_session_plan_he),
    corrections: corrections.slice(0, MAX_CORRECTIONS),
  }
}

/** Categories where the American version must use different words; sound-based ones may repeat them. */
const WORDING: CorrectionCategory[] = ['phrasing', 'grammar', 'word_choice']

function correction(item: unknown, context: RunReportContext): Correction[] {
  if (!isObject(item)) return []
  const category = oneOf(CORRECTION_CATEGORIES, item.category)
  const youSaid = text(item.you_said_en)
  const american = text(item.american_en)
  const principle = text(item.principle_he)
  if (!category || !youSaid || !american || !principle) return []
  if (WORDING.includes(category) && wordsOf(youSaid) === wordsOf(american)) return []

  const start = seconds(item.approx_start_sec, context.durationSec)
  const end = seconds(item.approx_end_sec, context.durationSec)
  return [
    {
      category,
      severity: oneOf(SEVERITIES, item.severity) ?? 'minor',
      you_said_en: youSaid,
      american_en: american,
      principle_he: principle,
      slide: slideNumber(item.slide, context.slideCount),
      approx_start_sec: start,
      approx_end_sec: start === null ? null : Math.max(start, end ?? start),
    },
  ]
}

/**
 * Up to 6 distinct keywords whose every word appears in the script, so memorization level L3 can
 * show them in place.
 */
export function normalizeKeywords(raw: unknown, script: string): string[] {
  const scriptWords = new Set(script.toLowerCase().match(WORD) ?? [])
  const seen = new Set<string>()
  const keywords: string[] = []
  for (const value of isObject(raw) ? list(raw.keywords) : []) {
    const keyword = text(value)
    const parts = keyword.toLowerCase().match(WORD) ?? []
    const key = parts.join(' ')
    if (!parts.length || seen.has(key) || !parts.every((part) => scriptWords.has(part))) continue
    seen.add(key)
    keywords.push(keyword)
    if (keywords.length === MAX_KEYWORDS) break
  }
  if (!keywords.length) throw new InvalidAnswer('keywords: none of them is in the script')
  return keywords
}

// Same word pattern as the memorization levels (src/features/present/memo.ts).
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown): T | null {
  return allowed.includes(value as T) ? (value as T) : null
}

function slideNumber(value: unknown, slideCount: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= slideCount ? value : null
}

function seconds(value: unknown, durationSec: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.round(Math.min(Math.max(value, 0), durationSec) * 10) / 10
}

function wordsOf(value: string): string {
  return (value.toLowerCase().match(WORD) ?? []).join(' ')
}
