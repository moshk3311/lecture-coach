// AI script drafting (ARCHITECTURE §5.1): a proposed script and bridge sentence for a slide, and
// drafting every slide that has no script yet. A proposal is never saved by itself; only a slide
// without a script is filled in directly (nothing is lost).
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { joinScript, planScriptSave, resegment } from '../../lib/script'
import { supabase } from '../../lib/supabase'
import { llm, type ScriptDraft } from '../../providers'
import { lectureKeys, patchDeckSlide, type LectureDeck, type Sentence, type SlideWithSentences } from './api'

/** Whether the slide has any script yet. */
export const hasScript = (slide: SlideWithSentences) => joinScript(slide.sentences).trim() !== ''

/**
 * Saves a script for the slide (sentences keep their ids where the text is unchanged) and its bridge
 * sentence. A slide that already has a bridge sentence keeps it unless `replaceBridge`.
 */
export async function saveScript(
  queryClient: QueryClient,
  lectureId: string,
  slide: SlideWithSentences,
  script: { text: string; transitionLine: string | null },
  replaceBridge: boolean,
): Promise<void> {
  const { data, error } = await supabase.rpc('save_slide_script', {
    p_slide_id: slide.id,
    p_sentences: planScriptSave(slide.sentences, resegment(slide.sentences, script.text)),
  })
  if (error) throw error
  patchDeckSlide(queryClient, lectureId, slide.id, { sentences: data as Sentence[] })

  const bridge = script.transitionLine
  if (bridge && bridge !== slide.transition_line && (replaceBridge || !slide.transition_line?.trim())) {
    const saved = await supabase.from('slides').update({ transition_line: bridge }).eq('id', slide.id)
    if (saved.error) throw saved.error
    patchDeckSlide(queryClient, lectureId, slide.id, { transition_line: bridge })
  }
}

/** Saves a draft as the slide's script and bridge sentence (see saveScript). */
export const saveDraft = (queryClient: QueryClient, lectureId: string, slide: SlideWithSentences, draft: ScriptDraft, replaceBridge: boolean) =>
  saveScript(queryClient, lectureId, slide, { text: draft.script_en, transitionLine: draft.transition_line }, replaceBridge)

/** Saves the intent notes the speaker typed for a slide, when they changed. */
export async function saveIntent(queryClient: QueryClient, lectureId: string, slide: SlideWithSentences, intent: string): Promise<void> {
  const next = intent.trim()
  if (next === (slide.intent_notes ?? '').trim()) return
  const { error } = await supabase.from('slides').update({ intent_notes: next || null }).eq('id', slide.id)
  if (error) throw error
  patchDeckSlide(queryClient, lectureId, slide.id, { intent_notes: next || null })
}

export type DraftAllState =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number; position: number }
  | { status: 'done'; drafted: number; failed: { position: number; message: string } | null }

/**
 * Drafts the slides that have no script, one after another (the free tier allows a few requests a
 * minute, and each slide continues the script of the one before it). It stops at the first failure
 * and keeps what was drafted.
 */
export function useDraftAll(deck: LectureDeck) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<DraftAllState>({ status: 'idle' })
  const [drafted, setDrafted] = useState<ReadonlySet<string>>(new Set())
  const cancelled = useRef(false)

  const start = useCallback(async () => {
    const todo = deck.slides.filter((slide) => !hasScript(slide))
    cancelled.current = false
    let count = 0
    let failed: { position: number; message: string } | null = null
    for (const slide of todo) {
      if (cancelled.current) break
      setState({ status: 'running', done: count, total: todo.length, position: slide.position })
      try {
        const draft = await llm.draftScript({ slideId: slide.id })
        // The deck in the cache is newer than the one this run started with (earlier drafts are in it).
        const fresh = queryClient.getQueryData<LectureDeck | null>(lectureKeys.detail(deck.id))?.slides.find((s) => s.id === slide.id) ?? slide
        await saveDraft(queryClient, deck.id, fresh, draft, false)
        count += 1
        setDrafted((prev) => new Set(prev).add(slide.id))
      } catch (error) {
        failed = { position: slide.position, message: error instanceof Error && error.message ? error.message : 'הניסוח נכשל.' }
        break
      }
    }
    setState({ status: 'done', drafted: count, failed })
    await queryClient.invalidateQueries({ queryKey: lectureKeys.detail(deck.id) })
  }, [deck.slides, deck.id, queryClient])

  return {
    state,
    drafted,
    start,
    cancel: () => {
      cancelled.current = true
    },
    dismiss: () => setState({ status: 'idle' }),
  }
}
