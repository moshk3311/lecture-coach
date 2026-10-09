// Coach tips in the run report (ARCHITECTURE §5.8): the catalog, what earlier takes showed, and the
// rule-based choice for one take. The choice is saved with the take (attempts.metrics.tips), so later
// takes can rotate away from it and notice a repeated issue.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import type { Json, Tables } from '../../lib/database.types'
import {
  CONTEXT_TRIGGERS,
  detectIssues,
  isTipTrigger,
  selectTips,
  type SelectedTip,
  type TipFacts,
  type TipHistory,
} from '../../lib/tips'
import { supabase } from '../../lib/supabase'
import { runKeys, useLectureRuns, type RunDetail, type RunMetrics } from './api'

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

export const tipKeys = { catalog: ['coach-tips'] as const }

/** The owner's active tips (private to them, §5.8). Empty until the catalog is imported. */
export function useCoachTips() {
  return useQuery({
    queryKey: tipKeys.catalog,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<CoachTip[]> => {
      const { data, error } = await supabase.from('coach_tips').select('*').eq('active', true).order('slug')
      if (error) throw error
      return data
    },
  })
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

function sameTips(a: SelectedTip[], b: SelectedTip[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * The rule tips of a take, chosen at once from its measurements and history, and saved with it
 * (again when an assessment changes the measurements). `loading` until the catalog and the
 * history are there.
 */
export function useRuleTips(run: RunDetail) {
  const queryClient = useQueryClient()
  const catalog = useCoachTips()
  const takes = useLectureRuns(run.lecture_id ?? '')

  const tips = useMemo(() => {
    if (!catalog.data || (run.lecture_id && !takes.data)) return null
    const history = tipHistory(run.created_at, takes.data ?? [])
    return selectTips(detectIssues(tipFacts(run), history), catalog.data, history.recentSlugs)
  }, [catalog.data, takes.data, run])

  const save = useMutation({
    mutationFn: async (chosen: SelectedTip[]) => {
      const metrics = { ...(run.metrics as object), tips: chosen } as unknown as Json
      const { error } = await supabase.from('attempts').update({ metrics }).eq('id', run.id)
      if (error) throw error
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: runKeys.detail(run.id) }),
        run.lecture_id ? queryClient.invalidateQueries({ queryKey: runKeys.lecture(run.lecture_id) }) : null,
      ]),
  })

  const key = tips ? JSON.stringify(tips) : ''
  const saved = savedTips(run.metrics)
  const stale = tips !== null && !sameTips(saved, tips)
  useEffect(() => {
    // A failed save is not retried until the tips change: the key is the only trigger.
    if (stale && tips) save.mutate(tips)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, stale])

  return { tips, catalog: catalog.data ?? [], loading: tips === null && !catalog.isError, failed: catalog.isError }
}
