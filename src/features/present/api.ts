import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { joinScript, planScriptSave, splitScript } from '../../lib/script'
import { supabase } from '../../lib/supabase'
import { llm } from '../../providers'
import { lectureKeys, patchDeckSlide, type LectureDeck, type Sentence, type SlideWithSentences } from '../lectures/api'
import { keywordsFit } from './memo'

/**
 * Keywords for memorization level L3 (§5.7): the stored ones while they still fit the script, else
 * new ones from Gemini, saved in slides.keywords. Gemini is asked only while `wanted` (the slide is
 * shown at L3), once per script text.
 */
export function useSlideKeywords(lectureId: string, slide: SlideWithSentences, script: string, wanted: boolean) {
  const queryClient = useQueryClient()
  const fit = keywordsFit(slide.keywords, script)
  const query = useQuery({
    queryKey: ['slide-keywords', slide.id, script],
    enabled: wanted && !fit && script.trim() !== '',
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const keywords = await llm.keywords({ slideScript: script })
      const { error } = await supabase.from('slides').update({ keywords }).eq('id', slide.id)
      if (error) throw error
      patchDeckSlide(queryClient, lectureId, slide.id, { keywords })
      return keywords
    },
  })
  return {
    /** null until there are keywords that fit the script. */
    keywords: fit ? slide.keywords! : (query.data ?? null),
    loading: query.isFetching,
    error: query.error,
    retry: () => void query.refetch(),
  }
}

export type SlideKeywords = ReturnType<typeof useSlideKeywords>

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Saves slide scripts one save at a time per slide: while a save runs, newer text waits and goes
 * out next, re-segmented against the ids the previous save returned.
 */
export function useScriptSaver(lectureId: string) {
  const queryClient = useQueryClient()
  const running = useRef(new Set<string>())
  const pending = useRef(new Map<string, string>())
  const failed = useRef(new Map<string, string>())
  const [status, setStatus] = useState<Record<string, SaveStatus>>({})
  // Text that is saved or on its way, shown instead of the stored script until the save lands.
  const [unsaved, setUnsaved] = useState<Record<string, string>>({})

  const save = useCallback(
    (slideId: string, text: string) => {
      pending.current.set(slideId, text)
      setUnsaved((prev) => ({ ...prev, [slideId]: text }))
      if (running.current.has(slideId)) return
      running.current.add(slideId)
      const mark = (s: SaveStatus) => setStatus((prev) => ({ ...prev, [slideId]: s }))
      const settle = () => {
        if (pending.current.has(slideId)) return
        setUnsaved((prev) => {
          const next = { ...prev }
          delete next[slideId]
          return next
        })
      }

      void (async () => {
        try {
          while (pending.current.has(slideId)) {
            const next = pending.current.get(slideId) ?? ''
            pending.current.delete(slideId)
            const deck = queryClient.getQueryData<LectureDeck | null>(lectureKeys.detail(lectureId))
            const slide = deck?.slides.find((s) => s.id === slideId)
            if (!slide) break
            const sentences = splitScript(next)
            if (joinScript(sentences) === joinScript(slide.sentences)) {
              // Nothing to save (e.g. the text went back to what is stored).
              setStatus((prev) => (prev[slideId] === 'error' ? { ...prev, [slideId]: 'idle' } : prev))
              settle()
              continue
            }
            mark('saving')
            const { data, error } = await supabase.rpc('save_slide_script', {
              p_slide_id: slideId,
              p_sentences: planScriptSave(slide.sentences, sentences),
            })
            if (error) {
              // Keep the newest text for "retry": an edit queued behind the failed save must not be lost.
              failed.current.set(slideId, pending.current.get(slideId) ?? next)
              pending.current.delete(slideId)
              mark('error')
              break
            }
            failed.current.delete(slideId)
            patchDeckSlide(queryClient, lectureId, slideId, { sentences: data as Sentence[] })
            mark('saved')
            settle()
          }
        } finally {
          running.current.delete(slideId)
        }
      })()
    },
    [lectureId, queryClient],
  )

  const retry = useCallback(
    (slideId: string) => {
      const text = failed.current.get(slideId)
      if (text !== undefined) save(slideId, text)
    },
    [save],
  )

  return { save, retry, status, unsaved }
}
