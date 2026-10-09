// Coach tips in the run report (ARCHITECTURE §5.8): the catalog and the rule-based choice for one
// take. The choice is saved with the take (attempts.metrics.tips), so later takes can rotate away
// from it and notice a repeated issue.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import type { Json } from '../../lib/database.types'
import { detectIssues, selectTips, type SelectedTip } from '../../lib/tips'
import { supabase } from '../../lib/supabase'
import { runKeys, useLectureRuns, type RunDetail } from './api'
import { savedTips, tipFacts, tipHistory, type CoachTip } from './tipData'

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

