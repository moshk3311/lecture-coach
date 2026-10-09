// Coach tips (ARCHITECTURE §5.8): issues found in a take from its measurements and history, and the
// pure choice of which catalog tips to show for them. Thresholds are the draft ones kept with the
// catalog; calibrate them on real takes. Pure and unit-tested.
import { formatClock } from './format'
import { TIP_TRIGGERS, type TipTrigger } from '../../supabase/functions/ai/contract.ts'
import { WPM_BAND } from './metrics'

export { TIP_TRIGGERS, type TipTrigger }

export const TRIGGER_LABELS_HE: Record<TipTrigger, string> = {
  pace_fast: 'קצב מהיר',
  pace_slow: 'קצב איטי',
  few_pauses: 'כמעט בלי עצירות',
  long_pauses: 'עצירות ארוכות',
  fillers: 'מילות מילוי',
  monotone: 'טון אחיד',
  overtime: 'חריגה מהזמן',
  slide_overrun: 'שקף שחרג מהחלון',
  low_coverage: 'דילוג על התסריט',
  and_heavy: 'הרבה and, מעט but',
  low_you: 'מעט פנייה לקהל',
  long_intro: 'פתיחה ארוכה',
  first_run: 'חזרה ראשונה',
  repeat_issue: 'אותה בעיה שוב',
  many_issues: 'הרבה נושאים לשיפור',
  low_energy: 'אנרגיה נמוכה',
  flat_emotion: 'בלי רגש',
  no_hook: 'פתיחה בלי הוק',
  no_key_point: 'מסר מרכזי לא ברור',
  no_story: 'בלי סיפור',
  weak_ending: 'סיום חלש',
}

export function isTipTrigger(value: unknown): value is TipTrigger {
  return typeof value === 'string' && (TIP_TRIGGERS as readonly string[]).includes(value)
}

/** The numbers of a take that the rules read (RunMetrics in src/features/runs/api.ts, plus the prosody score). */
export type TipFacts = {
  totalSeconds: number
  targetSeconds: number | null
  slides: { position: number; seconds: number; plannedSeconds: number; status: string }[]
  /** Null until Azure has assessed the take. */
  speech: {
    wpm: number | null
    perSlide: { position: number; wpm: number | null }[]
    fillersPerMinute: number
    longPauses: number
    coverage: number
  } | null
  prosody: number | null
}

/** What earlier takes of the same lecture say. */
export type TipHistory = {
  /** Full takes of this lecture before this one. */
  previousTakes: number
  /** The top trigger of the previous take, or null. */
  previousTopTrigger: TipTrigger | null
  /** Slugs shown in the last 5 takes, to rotate away from. */
  recentSlugs: string[]
}

export type Issue = {
  trigger: TipTrigger
  /** 0–1: how far past its threshold; ranks the issues. */
  severity: number
  /** The measurement behind it, in Hebrew, for the tip card. */
  evidence_he: string
  slide: number | null
}

/** Triggers about the take's context, not about something measured in it. */
export const CONTEXT_TRIGGERS: readonly TipTrigger[] = ['first_run', 'repeat_issue', 'many_issues']

const cap = (value: number) => Math.min(1, Math.max(0, value))
const pct = (value: number) => Math.round(value * 100)

export const THRESHOLDS = {
  paceSlowWpm: 130,
  fastSlides: 2,
  longPausesPerTwoMinutes: 1,
  fillersPerMinute: 2,
  monotoneProsody: 60,
  overtimeRatio: 0.1,
  slideOverrunSeconds: 15,
  coverage: 0.85,
  longIntroSeconds: 60,
  manyIssues: 4,
} as const

/** Issues found from measurements and history, most severe first. */
export function detectIssues(facts: TipFacts, history: TipHistory): Issue[] {
  const found: Issue[] = []
  const add = (trigger: TipTrigger, severity: number, evidence_he: string, slide: number | null = null) =>
    found.push({ trigger, severity: cap(severity), evidence_he, slide })

  const { targetSeconds, totalSeconds } = facts
  if (targetSeconds && totalSeconds > targetSeconds * (1 + THRESHOLDS.overtimeRatio)) {
    add('overtime', (totalSeconds - targetSeconds) / targetSeconds, `החזרה ארכה ${formatClock(totalSeconds)} מול יעד של ${formatClock(targetSeconds)}`)
  }

  const overrun = facts.slides
    .filter((s) => s.plannedSeconds > 0 && s.status === 'long' && s.seconds - s.plannedSeconds >= THRESHOLDS.slideOverrunSeconds)
    .sort((a, b) => b.seconds - b.plannedSeconds - (a.seconds - a.plannedSeconds))[0]
  if (overrun) {
    const over = overrun.seconds - overrun.plannedSeconds
    add('slide_overrun', over / 60, `שקף ${overrun.position} ארך ${formatClock(overrun.seconds)} מול ${formatClock(overrun.plannedSeconds)} מתוכנן`, overrun.position)
  }

  const first = [...facts.slides].sort((a, b) => a.position - b.position)[0]
  if (first && first.seconds > THRESHOLDS.longIntroSeconds) {
    add('long_intro', (first.seconds - THRESHOLDS.longIntroSeconds) / 120, `השקף הראשון ארך ${formatClock(first.seconds)}`, first.position)
  }

  const { speech } = facts
  if (speech) {
    const fastSlides = speech.perSlide.filter((s) => s.wpm !== null && s.wpm > WPM_BAND.max)
    if ((speech.wpm !== null && speech.wpm > WPM_BAND.max) || fastSlides.length >= THRESHOLDS.fastSlides) {
      const where = fastSlides.length ? ` (בשקפים ${fastSlides.map((s) => s.position).join(', ')})` : ''
      const wpm = speech.wpm ?? Math.max(...fastSlides.map((s) => s.wpm ?? 0))
      add('pace_fast', (wpm - WPM_BAND.max) / 60, `${Math.round(wpm)} מילים לדקה${where}, היעד ${WPM_BAND.min}–${WPM_BAND.max}`, fastSlides[0]?.position ?? null)
    }
    if (speech.wpm !== null && speech.wpm < THRESHOLDS.paceSlowWpm) {
      add('pace_slow', (THRESHOLDS.paceSlowWpm - speech.wpm) / 50, `${Math.round(speech.wpm)} מילים לדקה, היעד ${WPM_BAND.min}–${WPM_BAND.max}`)
    }
    const pausesPerTwoMinutes = totalSeconds > 0 ? speech.longPauses / (totalSeconds / 120) : 0
    if (pausesPerTwoMinutes >= THRESHOLDS.longPausesPerTwoMinutes) {
      add('long_pauses', pausesPerTwoMinutes / 3, `${speech.longPauses} עצירות ארוכות מ-1.5 שניות`)
    }
    if (speech.fillersPerMinute >= THRESHOLDS.fillersPerMinute) {
      add('fillers', speech.fillersPerMinute / 6, `${speech.fillersPerMinute} מילות מילוי לדקה`)
    }
    if (speech.coverage < THRESHOLDS.coverage) {
      add('low_coverage', (THRESHOLDS.coverage - speech.coverage) / 0.5, `אמרת ${pct(speech.coverage)}% מהתסריט`)
    }
  }
  if (facts.prosody !== null && facts.prosody < THRESHOLDS.monotoneProsody) {
    add('monotone', (THRESHOLDS.monotoneProsody - facts.prosody) / 40, `ציון הטון והדגשים ${Math.round(facts.prosody)} מתוך 100`)
  }

  // Context triggers come last: they depend on what was found above.
  const measured = found.filter((issue) => !CONTEXT_TRIGGERS.includes(issue.trigger))
  if (history.previousTopTrigger && measured.some((issue) => issue.trigger === history.previousTopTrigger)) {
    add('repeat_issue', 0.45, `גם בחזרה הקודמת הנושא המרכזי היה: ${TRIGGER_LABELS_HE[history.previousTopTrigger]}`)
  }
  if (measured.length >= THRESHOLDS.manyIssues) add('many_issues', 0.4, `${measured.length} נושאים לשיפור בחזרה הזו`)
  if (history.previousTakes === 0) add('first_run', 0.05, 'זו החזרה הראשונה של ההרצאה הזו')

  return found.sort((a, b) => b.severity - a.severity)
}

/** The part of a catalog tip that the choice reads. */
export type CatalogTip = { slug: string; triggers: string[]; rotating: boolean }

/** A tip chosen for the report. `trigger` is null for the rotating tip that fills a short list. */
export type SelectedTip = { slug: string; trigger: TipTrigger | null; evidence_he: string | null; slide: number | null }

export const MAX_RULE_TIPS = 3

/**
 * One tip per issue, most severe first, at most 3. A tip shown in one of the last 5 takes is skipped
 * when another fits. With fewer than 3 tips, one rotating tip (no trigger) is added.
 */
export function selectTips(issues: Issue[], catalog: CatalogTip[], recentSlugs: string[], max = MAX_RULE_TIPS): SelectedTip[] {
  const recent = new Set(recentSlugs)
  const chosen: SelectedTip[] = []
  const taken = new Set<string>()

  const pick = (fits: CatalogTip[]): CatalogTip | undefined =>
    fits.find((tip) => !taken.has(tip.slug) && !recent.has(tip.slug)) ?? fits.find((tip) => !taken.has(tip.slug))

  for (const issue of issues) {
    if (chosen.length >= max) break
    const tip = pick(catalog.filter((t) => t.triggers.includes(issue.trigger)))
    if (!tip) continue
    taken.add(tip.slug)
    chosen.push({ slug: tip.slug, trigger: issue.trigger, evidence_he: issue.evidence_he, slide: issue.slide })
  }

  if (chosen.length < max) {
    const filler = pick(catalog.filter((t) => t.rotating))
    if (filler) chosen.push({ slug: filler.slug, trigger: null, evidence_he: null, slide: null })
  }
  return chosen
}
