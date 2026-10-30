import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Check, LoaderCircle, Merge, Pilcrow, Scissors, X } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '../../components/Alert'
import { En } from '../../components/En'
import { buttonStyles } from '../../components/styles'
import { formatClock } from '../../lib/format'
import {
  countWords,
  LONG_SENTENCE_WORDS,
  mergeWithNext,
  moveSentence,
  splitSentence,
  toggleParagraph,
  type SentenceDraft,
} from '../../lib/script'
import { supabase } from '../../lib/supabase'
import { speakingSeconds } from '../present/plan'
import { patchDeckSlide, type Sentence, type SlideWithSentences } from './api'

const iconButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-soft hover:bg-ink/5 hover:text-ink disabled:pointer-events-none disabled:opacity-30'

/** The slide's sentences, the practice units (§5.1): split, merge, reorder and paragraphs, with words and time per sentence. */
export function SentenceEditor({ lectureId, slide, onClose }: { lectureId: string; slide: SlideWithSentences; onClose: () => void }) {
  const queryClient = useQueryClient()
  const stored: SentenceDraft[] = slide.sentences.map(({ id, text, starts_paragraph }) => ({ id, text, starts_paragraph }))
  const [list, setList] = useState(stored)
  const [splitting, setSplitting] = useState<number | null>(null)
  const dirty = JSON.stringify(list) !== JSON.stringify(stored)

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('save_slide_script', { p_slide_id: slide.id, p_sentences: list })
      if (error) throw error
      patchDeckSlide(queryClient, lectureId, slide.id, { sentences: data as Sentence[] })
    },
    onSuccess: onClose,
  })

  const edit = (next: SentenceDraft[]) => {
    setSplitting(null)
    setList(next)
  }
  const words = list.reduce((sum, s) => sum + countWords(s.text), 0)

  return (
    <div className="mt-3 border-t border-rule pt-3">
      <p className="text-sm text-ink-soft">כל משפט הוא יחידת תרגול. פצל משפט ארוך, מזג משפטים קצרים או שנה סדר.</p>
      <ol className="mt-3 space-y-2" aria-label="משפטים">
        {list.map((sentence, index) => {
          const count = countWords(sentence.text)
          const long = count > LONG_SENTENCE_WORDS
          return (
            <li key={`${sentence.id ?? 'new'}-${index}`}>
              {index > 0 && sentence.starts_paragraph ? (
                <p className="mb-1 flex items-center gap-1 text-xs text-ink-faint">
                  <Pilcrow size={12} aria-hidden="true" />
                  פסקה חדשה
                </p>
              ) : null}
              <div className={`rounded-lg border bg-card p-2.5 ${long ? 'border-warn/60' : 'border-rule'}`}>
                <div className="flex gap-2">
                  <span className="w-5 shrink-0 pt-0.5 text-center font-mono text-xs text-ink-faint">{index + 1}</span>
                  {splitting === index ? (
                    <SplitPicker text={sentence.text} onPick={(word) => edit(splitSentence(list, index, word))} />
                  ) : (
                    <En as="p" className="min-w-0 flex-1 text-[15px] leading-relaxed">
                      {sentence.text}
                    </En>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 ps-7">
                  <p className="text-xs text-ink-faint">
                    {count} מילים ·{' '}
                    <span dir="ltr" className="font-mono">
                      {formatClock(Math.round(speakingSeconds(count)))}
                    </span>
                    {long ? <span className="ms-2 rounded bg-warn-soft px-1.5 py-0.5 text-warn">ארוך לתרגול</span> : null}
                  </p>
                  {splitting === index ? (
                    <button type="button" onClick={() => setSplitting(null)} className={`${buttonStyles.ghost} h-9 text-sm`}>
                      ביטול
                    </button>
                  ) : (
                    <div className="-me-1.5 flex">
                      <button type="button" disabled={count < 2} onClick={() => setSplitting(index)} className={iconButton} aria-label="פצל" title="פצל">
                        <Scissors size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={index === list.length - 1}
                        onClick={() => edit(mergeWithNext(list, index))}
                        className={iconButton}
                        aria-label="מזג עם הבא"
                        title="מזג עם הבא"
                      >
                        <Merge size={16} aria-hidden="true" />
                      </button>
                      <button type="button" disabled={index === 0} onClick={() => edit(moveSentence(list, index, -1))} className={iconButton} aria-label="הזז למעלה" title="הזז למעלה">
                        <ArrowUp size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={index === list.length - 1}
                        onClick={() => edit(moveSentence(list, index, 1))}
                        className={iconButton}
                        aria-label="הזז למטה"
                        title="הזז למטה"
                      >
                        <ArrowDown size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => edit(toggleParagraph(list, index))}
                        className={`${iconButton} ${index > 0 && sentence.starts_paragraph ? 'bg-accent-soft text-accent' : ''}`}
                        aria-label="פסקה חדשה"
                        aria-pressed={index > 0 && sentence.starts_paragraph}
                        title="פסקה חדשה"
                      >
                        <Pilcrow size={16} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <p className="mt-3 text-sm text-ink-soft">
        {list.length} משפטים · {words} מילים · דיבור{' '}
        <span dir="ltr" className="font-mono">
          {formatClock(Math.round(speakingSeconds(words)))}
        </span>
      </p>
      {save.error ? (
        <div className="mt-3">
          <Alert>{save.error.message || 'השמירה נכשלה. נסה שוב.'}</Alert>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate()} className={`${buttonStyles.primary} h-10 text-sm`}>
          {save.isPending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
          שמור
        </button>
        <button type="button" disabled={save.isPending} onClick={onClose} className={`${buttonStyles.secondary} h-10 text-sm`}>
          <X size={16} aria-hidden="true" />
          {dirty ? 'בטל' : 'סגור'}
        </button>
      </div>
    </div>
  )
}

/** The sentence's words as buttons: the tapped word opens the new sentence. */
function SplitPicker({ text, onPick }: { text: string; onPick: (word: number) => void }) {
  const words = text.trim().split(/\s+/)
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-xs text-accent">הקש על המילה שתפתח את המשפט החדש</p>
      <En as="p" className="flex flex-wrap gap-1 text-[15px] leading-relaxed">
        {words.map((word, i) =>
          i === 0 ? (
            <span key={i} className="px-1 py-0.5 text-ink-faint">
              {word}
            </span>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => onPick(i)}
              aria-label={`פצל לפני ${word}`}
              className="rounded border border-rule px-1 py-0.5 hover:border-accent hover:bg-accent-soft"
            >
              {word}
            </button>
          ),
        )}
      </En>
    </div>
  )
}
