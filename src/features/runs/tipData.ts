// The data side of the coach tips in the run report (ARCHITECTURE §5.8): reading what is saved with a
// take, the facts and history the rules read, and the cards the report shows. Pure and unit-tested;
// the queries and the save are in coachTips.ts.
import type { Json, Tables } from '../../lib/database.types'
import { CONTEXT_TRIGGERS, isTipTrigger, type SelectedTip, type TipFacts, type TipHistory } from '../../lib/tips'
import type { ReportTip } from '../../providers'
import type { RunDetail, RunMetrics } from './api'

export type CoachTip = Tables<'coach_tips'>
export type TipSource = { speaker: string; title: string; event: string; url: string }

export const CATEGORY_LABELS_HE: Record<string, string> = {
  delivery: 'קול וקצב',
  structure: 'מבנה וסיפור',
  humor: 'הומור',
  stage: 'נוכחות על הבמה',
  practice: 'שיטת אימון',
  mindset: 'ביטחון',
}

/** The sources of a tip, keeping only complete entries with an https link. */
export function tipSources(value: Json): TipSource[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): TipSource[] => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return []
    const { speaker, title, event, url } = item
    const ok = [speaker, title, event, url].every((v) => typeof v === 'string' && v)
    return ok && String(url).startsWith('https://') ? [{ speaker, title, event, url } as TipSource] : []
  })
}

/** The tips saved with a take; anything unreadable is dropped. */
export function savedTips(metrics: unknown): SelectedTip[] {
  const raw = typeof metrics === 'object' && metrics !== null ? (metrics as { tips?: unknown }).tips : undefined
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): SelectedTip[] => {
    if (typeof item !== 'object' || item === null) return []
    const { slug, trigger, evidence_he, slide } = item as Record<string, unknown>
    if (typeof slug !== 'string' || !slug) return []
    return [
      {
        slug,
        trigger: isTipTrigger(trigger) ? trigger : null,
        evidence_he: typeof evidence_he === 'string' ? evidence_he : null,
        slide: typeof slide === 'number' ? slide : null,
      },
    ]
  })
}

/** The numbers of a take the rules read. */
export function tipFacts(run: Pick<RunDetail, 'metrics' | 'prosody'>): TipFacts {
  const metrics = run.metrics as unknown as RunMetrics
  const speech = metrics.speech
  return {
    totalSeconds: metrics.totalSeconds,
    targetSeconds: metrics.targetSeconds,
    slides: metrics.slides.map(({ position, seconds, plannedSeconds, status }) => ({ position, seconds, plannedSeconds, status })),
    speech: speech
      ? {
          wpm: speech.wpm,
          perSlide: speech.perSlide.map(({ position, wpm }) => ({ position, wpm })),
          fillersPerMinute: speech.fillersPerMinute,
          longPauses: speech.pauses.long,
          coverage: speech.coverage.ratio,
        }
      : null,
    prosody: run.prosody === null ? null : Number(run.prosody),
  }
}

type EarlierTake = { created_at: string; metrics: Json | null }

/** What the takes before this one (newest first among `takes`) show: how many, the top issue, tips to rotate away from. */
export function tipHistory(createdAt: string, takes: EarlierTake[]): TipHistory {
  const earlier = takes.filter((take) => take.created_at < createdAt)
  const previous = savedTips(earlier[0]?.metrics)
  return {
    previousTakes: earlier.length,
    previousTopTrigger: previous.find((tip) => tip.trigger !== null && !CONTEXT_TRIGGERS.includes(tip.trigger))?.trigger ?? null,
    recentSlugs: earlier.slice(0, 5).flatMap((take) => savedTips(take.metrics).map((tip) => tip.slug)),
  }
}

/** What a tip card shows: the tip, and where it came from (§5.8 Card). */
export type TipCardData = {
  key: string
  /** rule: from the measurements · rotating: fills a short list · heard: Gemini heard it · general: Gemini's own advice. */
  origin: 'rule' | 'rotating' | 'heard' | 'general'
  category: string | null
  title_he: string
  body_he: string
  example_en: string | null
  sources: TipSource[]
  trigger: SelectedTip['trigger']
  /** The measurement behind a rule tip. */
  evidence_he: string | null
  /** Where in the take Gemini placed it, with a line tying it to that moment. */
  moment: { personal_he: string; said_en: string | null; slide: number | null; startSec: number | null } | null
}

const momentOf = (tip: ReportTip | undefined): TipCardData['moment'] =>
  tip ? { personal_he: tip.personal_he, said_en: tip.said_en, slide: tip.slide, startSec: tip.approx_start_sec } : null

/**
 * The cards of a report: the rule tips first (each with Gemini's anchor when it gave one), then the
 * tips Gemini added from listening. A Gemini tip with a slug the catalog does not have is dropped.
 */
export function tipCards(rule: SelectedTip[], catalog: CoachTip[], ai: ReportTip[]): TipCardData[] {
  const bySlug = new Map(catalog.map((tip) => [tip.slug, tip]))
  const anchors = new Map(ai.flatMap((tip) => (tip.slug ? [[tip.slug, tip] as const] : [])))
  const fromCatalog = (tip: CoachTip) => ({
    category: tip.category,
    title_he: tip.title_he,
    body_he: tip.body_he,
    example_en: tip.example_en,
    sources: tipSources(tip.sources),
  })

  const cards: TipCardData[] = []
  for (const chosen of rule) {
    const tip = bySlug.get(chosen.slug)
    if (!tip) continue
    cards.push({
      key: tip.slug,
      origin: chosen.trigger ? 'rule' : 'rotating',
      ...fromCatalog(tip),
      trigger: chosen.trigger,
      evidence_he: chosen.evidence_he,
      moment: momentOf(anchors.get(tip.slug)),
    })
  }
  const shown = new Set(cards.map((card) => card.key))
  ai.forEach((tip, i) => {
    if (tip.slug === null) {
      cards.push({
        key: `general-${i}`,
        origin: 'general',
        category: null,
        title_he: tip.title_he ?? '',
        body_he: tip.body_he ?? '',
        example_en: tip.example_en,
        sources: [],
        trigger: tip.trigger,
        evidence_he: null,
        moment: momentOf(tip),
      })
      return
    }
    const entry = bySlug.get(tip.slug)
    if (!entry || shown.has(tip.slug)) return
    shown.add(tip.slug)
    cards.push({ key: tip.slug, origin: 'heard', ...fromCatalog(entry), trigger: tip.trigger, evidence_he: null, moment: momentOf(tip) })
  })
  return cards
}
