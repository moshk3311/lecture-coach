// The `ai` function's contract (ARCHITECTURE §7): what each action returns, the response schemas
// Gemini must follow, and the checks every answer passes before it is saved or returned.
// Pure (no Deno APIs): the app imports its types, and Vitest tests it.
import { isObject, list, num, text } from './json.ts'

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

/** Every trigger a coach tip can have (§5.8); the catalog's `triggers` use these names. */
export const TIP_TRIGGERS = [
  'pace_fast',
  'pace_slow',
  'few_pauses',
  'long_pauses',
  'fillers',
  'monotone',
  'overtime',
  'slide_overrun',
  'low_coverage',
  'and_heavy',
  'low_you',
  'long_intro',
  'first_run',
  'repeat_issue',
  'many_issues',
  'low_energy',
  'flat_emotion',
  'no_hook',
  'no_key_point',
  'no_story',
  'weak_ending',
] as const

export type TipTrigger = (typeof TIP_TRIGGERS)[number]

/** What only listening reveals: Gemini may add a tip for these (§5.8). */
export const HEARD_TRIGGERS: readonly TipTrigger[] = ['low_energy', 'flat_emotion', 'no_hook', 'no_key_point', 'no_story', 'weak_ending']

/** Azure measures these; Gemini reports them only for a take that was not assessed (no Azure keys, or not yet scored). */
export const LISTENED_TRIGGERS: readonly TipTrigger[] = ['pace_fast', 'pace_slow', 'few_pauses', 'long_pauses', 'fillers', 'monotone', 'and_heavy', 'low_you']

/**
 * A coach tip tied to a moment of the take (§5.8). A tip with a slug is one of the owner's catalog tips;
 * without one (slug null) it is Gemini's own advice, with its own title and body, never shown as the notebook's.
 */
export type ReportTip = {
  slug: string | null
  from_notebook: boolean
  trigger: TipTrigger
  slide: number | null
  approx_start_sec: number | null
  /** The words said at that moment, or null (no recording, or none quoted). */
  said_en: string | null
  /** One Hebrew sentence that ties the tip to that moment. */
  personal_he: string
  example_en: string | null
  title_he: string | null
  body_he: string | null
}

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
  /** Anchors for the rule-chosen tips and up to 2 more from listening; absent in reports from before Sprint 2b. */
  tips?: ReportTip[]
}

export type KeywordsResult = { keywords: string[] }

/** A drafted script for one slide (§5.1 AI script drafting): a proposal the owner accepts or refuses. */
export type ScriptDraft = {
  /** Spoken American English, one paragraph per line, as the script editor stores it. */
  script_en: string
  /** The bridge sentence into the next slide (the "Before you click" line); null on the last slide. */
  transition_line: string | null
  /** Why it is written this way, in Hebrew. */
  notes_he: string
  words: number
  /** Speaking time of the script at 140 words per minute. */
  estimated_seconds: number
  /** The slide's time budget, when there is one. */
  budget_seconds: number | null
  /** Gemini saw the slide's picture, not only its text. */
  saw_image: boolean
  model: string
  prompt_version: string
}

/** One change "Americanize" made, with its reason in Hebrew. `to` is '' when words were cut. */
export type ScriptChange = { from: string; to: string; reason_he: string }

/** A script revised to natural spoken American English (§5.1 "Americanize"): a proposal, nothing is saved. */
export type AmericanizeResult = {
  /** One paragraph per line, as the script editor stores it. */
  text_en: string
  /** The revised bridge sentence; null when the slide has none. */
  transition_line: string | null
  /** Each change once, in script order as far as the model keeps it; empty when the text already sounds right. */
  changes: ScriptChange[]
  model: string
  prompt_version: string
}

export const MAX_STRENGTHS = 3
export const MAX_IMPROVEMENTS = 3
export const MAX_CORRECTIONS = 8
export const MAX_KEYWORDS = 6
/** Tips Gemini adds beyond the rule-chosen ones. */
export const MAX_EXTRA_TIPS = 2
export const MAX_REPORT_TIPS = 5

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

const NULLABLE_STRING = { type: 'STRING', nullable: true }
const NULLABLE_NUMBER = { type: 'NUMBER', nullable: true }

const REPORT_TIP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    slug: NULLABLE_STRING,
    trigger: { type: 'STRING', enum: [...TIP_TRIGGERS] },
    slide: SLIDE,
    approx_start_sec: NULLABLE_NUMBER,
    said_en: NULLABLE_STRING,
    personal_he: STRING,
    example_en: NULLABLE_STRING,
    title_he: NULLABLE_STRING,
    body_he: NULLABLE_STRING,
  },
  required: ['slug', 'trigger', 'slide', 'approx_start_sec', 'said_en', 'personal_he', 'example_en', 'title_he', 'body_he'],
  propertyOrdering: ['slug', 'trigger', 'slide', 'approx_start_sec', 'said_en', 'personal_he', 'example_en', 'title_he', 'body_he'],
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
    tips: { type: 'ARRAY', items: REPORT_TIP_SCHEMA, maxItems: MAX_REPORT_TIPS },
  },
  required: ['summary_he', 'strengths_he', 'improvements', 'next_session_plan_he', 'corrections', 'tips'],
  propertyOrdering: ['summary_he', 'strengths_he', 'improvements', 'next_session_plan_he', 'corrections', 'tips'],
}

export const DRAFT_SCHEMA = {
  type: 'OBJECT',
  properties: { script_en: STRING, transition_line_en: { type: 'STRING', nullable: true }, notes_he: STRING },
  required: ['script_en', 'transition_line_en', 'notes_he'],
  propertyOrdering: ['script_en', 'transition_line_en', 'notes_he'],
}

export const MAX_CHANGES = 12

export const AMERICANIZE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    text_en: STRING,
    transition_line_en: { type: 'STRING', nullable: true },
    changes: {
      type: 'ARRAY',
      maxItems: MAX_CHANGES,
      items: {
        type: 'OBJECT',
        properties: { from: STRING, to: STRING, reason_he: STRING },
        required: ['from', 'to', 'reason_he'],
        propertyOrdering: ['from', 'to', 'reason_he'],
      },
    },
  },
  required: ['text_en', 'transition_line_en', 'changes'],
  propertyOrdering: ['text_en', 'transition_line_en', 'changes'],
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
  /** Slugs of the owner's catalog; empty when the catalog is not imported (every tip is then general). */
  catalogSlugs: string[]
  /** Slugs of the tips the rules chose for this take (saved in metrics.tips). */
  ruleSlugs: string[]
  /** Azure has scored the take, so it owns the measured triggers. */
  assessed: boolean
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
    tips: reportTips(raw.tips, context),
  }
}

/**
 * Keeps the tips the report can show. A tip with a slug needs that slug in the catalog (an unknown
 * one is dropped), and appears once. A rule-chosen tip is kept as an anchor. Any other tip is an
 * extra, at most 2: it needs the recording (it comes from listening) and a trigger Gemini may
 * report. A tip with no slug is Gemini's own advice and needs its own title and body.
 */
function reportTips(value: unknown, context: RunReportContext): ReportTip[] {
  const catalog = new Set(context.catalogSlugs)
  const rule = new Set(context.ruleSlugs)
  const seen = new Set<string>()
  const anchors: ReportTip[] = []
  const extras: ReportTip[] = []

  for (const item of list(value)) {
    if (!isObject(item)) continue
    const trigger = oneOf(TIP_TRIGGERS, item.trigger)
    const personal = text(item.personal_he)
    if (!trigger || !personal) continue

    const slug = text(item.slug) || null
    if (slug !== null) {
      if (!catalog.has(slug) || seen.has(slug)) continue
      seen.add(slug)
    }
    const anchor = slug !== null && rule.has(slug)
    if (!anchor) {
      const hearable = HEARD_TRIGGERS.includes(trigger) || (!context.assessed && LISTENED_TRIGGERS.includes(trigger))
      if (!context.heardAudio || !hearable) continue
    }
    const title = slug === null ? text(item.title_he) : ''
    const body = slug === null ? text(item.body_he) : ''
    if (slug === null && (!title || !body)) continue

    const tip: ReportTip = {
      slug,
      from_notebook: slug !== null,
      trigger,
      slide: slideNumber(item.slide, context.slideCount),
      approx_start_sec: context.heardAudio ? seconds(item.approx_start_sec, context.durationSec) : null,
      said_en: context.heardAudio ? text(item.said_en) || null : null,
      personal_he: personal,
      example_en: slug === null ? text(item.example_en) || null : null,
      title_he: slug === null ? title : null,
      body_he: slug === null ? body : null,
    }
    ;(anchor ? anchors : extras).push(tip)
  }
  return [...anchors, ...extras.slice(0, MAX_EXTRA_TIPS)]
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

export type DraftContext = {
  budgetSeconds: number | null
  sawImage: boolean
  isLastSlide: boolean
  model: string
  promptVersion: string
}

/** Words per minute the planned time of a slide is based on (src/features/present/plan.ts). */
export const DRAFT_WPM = 140
const HEBREW = /[\u0590-\u05FF]/

/**
 * Checks a drafted script: English only (Hebrew letters mean the model answered in the wrong
 * language), one paragraph per line, its speaking time worked out here, and no bridge sentence on
 * the last slide.
 */
export function normalizeDraft(raw: unknown, context: DraftContext): ScriptDraft {
  if (!isObject(raw)) throw new InvalidAnswer('draft_script: the answer is not an object')
  const script = scriptLines(raw.script_en)
  const words = script.match(WORD)?.length ?? 0
  if (!words) throw new InvalidAnswer('draft_script: the answer has no script')
  if (HEBREW.test(script)) throw new InvalidAnswer('draft_script: the script is not in English')

  const bridge = text(raw.transition_line_en)
  return {
    script_en: script,
    transition_line: context.isLastSlide || !bridge || HEBREW.test(bridge) ? null : bridge,
    notes_he: text(raw.notes_he),
    words,
    estimated_seconds: Math.round((words * 60) / DRAFT_WPM),
    budget_seconds: context.budgetSeconds,
    saw_image: context.sawImage,
    model: context.model,
    prompt_version: context.promptVersion,
  }
}

/** A script as the editor stores it: one paragraph per line, spaces collapsed, no empty lines. */
function scriptLines(value: unknown): string {
  return (typeof value === 'string' ? value : '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

export type AmericanizeContext = {
  /** The script that was sent, as the editor stores it. */
  text: string
  transitionLine: string | null
  model: string
  promptVersion: string
}

/** Lower case with single spaces and straight apostrophes, for finding a quoted phrase in a text. */
function folded(value: string): string {
  return value.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()
}

/**
 * Checks an "Americanize" answer: an English script, a bridge sentence only when one was sent (the
 * sent one stays when the answer's is missing or not English), and changes whose `from` is really in
 * what was sent, each once and with a reason. No changes when the text came back the same.
 */
export function normalizeAmericanize(raw: unknown, context: AmericanizeContext): AmericanizeResult {
  if (!isObject(raw)) throw new InvalidAnswer('americanize: the answer is not an object')
  const revised = scriptLines(raw.text_en)
  if (!(revised.match(WORD)?.length ?? 0)) throw new InvalidAnswer('americanize: the answer has no text')
  if (HEBREW.test(revised)) throw new InvalidAnswer('americanize: the text is not in English')

  const sentBridge = context.transitionLine?.trim() || null
  const answerBridge = text(raw.transition_line_en).replace(/\s+/g, ' ')
  const bridge = sentBridge === null ? null : answerBridge && !HEBREW.test(answerBridge) ? answerBridge : sentBridge

  const unchanged = revised === scriptLines(context.text) && bridge === sentBridge
  const source = folded(`${context.text}\n${sentBridge ?? ''}`)
  const seen = new Set<string>()
  const changes: ScriptChange[] = []
  for (const item of unchanged ? [] : list(raw.changes)) {
    if (!isObject(item)) continue
    const from = text(item.from).replace(/\s+/g, ' ')
    const to = text(item.to).replace(/\s+/g, ' ')
    const reason = text(item.reason_he)
    const key = `${folded(from)}→${folded(to)}`
    if (!from || !reason || folded(from) === folded(to) || !source.includes(folded(from)) || seen.has(key)) continue
    if (HEBREW.test(from) || HEBREW.test(to)) continue
    seen.add(key)
    changes.push({ from, to, reason_he: reason })
    if (changes.length === MAX_CHANGES) break
  }
  return {
    text_en: revised,
    transition_line: bridge,
    changes,
    model: context.model,
    prompt_version: context.promptVersion,
  }
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

function oneOf<T extends string>(allowed: readonly T[], value: unknown): T | null {
  return allowed.includes(value as T) ? (value as T) : null
}

function slideNumber(value: unknown, slideCount: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= slideCount ? value : null
}

function seconds(value: unknown, durationSec: number): number | null {
  const n = num(value)
  return n === null ? null : Math.round(Math.min(Math.max(n, 0), durationSec) * 10) / 10
}

function wordsOf(value: string): string {
  return (value.toLowerCase().match(WORD) ?? []).join(' ')
}
