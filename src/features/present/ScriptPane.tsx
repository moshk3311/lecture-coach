import { Check, CircleAlert, LoaderCircle, Pencil } from 'lucide-react'
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type FocusEvent } from 'react'
import { kickerStyles } from '../../components/styles'
import type { SlideWithSentences } from '../lectures/api'
import type { SaveStatus, SlideKeywords } from './api'
import type { MemoLevel } from './memo'
import { MemoText } from './MemoText'

export type EditField = 'script' | 'transition'

/** Typing pauses this long before an autosave. */
const AUTOSAVE_MS = 1200

type ScriptPaneProps = {
  slide: SlideWithSentences
  /** The slide's script, including text that is still being saved. */
  script: string
  level: MemoLevel
  /** L3's keywords and how getting them goes. */
  keywords: SlideKeywords
  peeking: boolean
  editing: EditField | null
  saveStatus: SaveStatus
  onEdit: (field: EditField | null) => void
  onSaveScript: (text: string) => void
  onSaveTransition: (text: string) => void
  onRetry: () => void
}

export function ScriptPane(props: ScriptPaneProps) {
  const { slide, script, level, keywords, peeking, editing, saveStatus, onEdit, onRetry } = props
  const shownLevel = peeking ? 0 : level
  // Until Gemini's keywords arrive (or when it fails), L3 shows first letters.
  const awaitingKeywords = shownLevel === 3 && keywords.keywords === null
  const textLevel = awaitingKeywords ? 2 : shownLevel

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-rule bg-card">
      <div className="flex items-center gap-2 border-b border-rule px-4 py-2">
        <p className={kickerStyles}>
          <span dir="ltr" lang="en">
            Script · L{level}
            {peeking ? ' · peek' : ''}
          </span>
        </p>
        <SaveBadge status={saveStatus} onRetry={onRetry} />
        {editing ? null : (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onEdit('script')}
            className="ms-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink"
          >
            <Pencil size={14} aria-hidden="true" />
            עריכה
          </button>
        )}
      </div>

      {editing ? (
        <ScriptEditor {...props} field={editing} />
      ) : (
        <>
          <div
            className="min-h-0 flex-1 cursor-text overflow-y-auto px-4 py-3 text-[17px] leading-[1.65] md:px-5 md:py-4 md:text-[20px]"
            onClick={() => onEdit('script')}
          >
            {!script.trim() ? (
              <p className="text-base text-ink-faint">עוד אין תסריט לשקף הזה. לחץ כאן (או E) כדי לכתוב.</p>
            ) : shownLevel === 4 ? (
              <p className="text-base text-ink-faint">
                <span dir="ltr">L4</span>: בלי תסריט. <span dir="ltr">P</span> להצצה.
              </p>
            ) : (
              <>
                {awaitingKeywords ? <KeywordsStatus keywords={keywords} /> : null}
                <MemoText text={script} level={textLevel} keywords={keywords.keywords ?? []} />
              </>
            )}
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onEdit('transition')}
            className="m-3 mt-0 rounded-xl border-s-4 border-accent bg-accent-soft px-4 py-2.5 text-start"
            dir="ltr"
          >
            <span className={`${kickerStyles} block text-accent`} lang="en">
              Before you click
            </span>
            {slide.transition_line?.trim() ? (
              shownLevel === 4 ? (
                <span className="text-sm text-ink-faint" dir="rtl">
                  מוסתר ב-L4
                </span>
              ) : (
                <MemoText
                  text={slide.transition_line}
                  level={textLevel}
                  keywords={keywords.keywords ?? []}
                  className="mt-0.5 text-[16px] leading-snug font-medium md:text-[18px]"
                />
              )
            ) : (
              <span className="mt-0.5 block text-sm text-ink-soft" dir="rtl">
                הוסף משפט גשר לשקף הבא
              </span>
            )}
          </button>
        </>
      )}
    </section>
  )
}

function ScriptEditor({
  slide,
  script,
  field,
  onEdit,
  onSaveScript,
  onSaveTransition,
}: ScriptPaneProps & { field: EditField }) {
  const [draft, setDraft] = useState(script)
  const [transition, setTransition] = useState(slide.transition_line ?? '')
  const containerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Effect events always see the latest props, so the presenter view re-rendering with the timer
  // does not restart the autosave countdown.
  const saveScript = useEffectEvent(() => onSaveScript(draft))
  const saveTransition = useEffectEvent(() => {
    if (transition.trim() !== (slide.transition_line ?? '').trim()) onSaveTransition(transition)
  })

  // Autosave after a pause in typing.
  useEffect(() => {
    const id = window.setTimeout(saveScript, AUTOSAVE_MS)
    return () => window.clearTimeout(id)
  }, [draft])
  useEffect(() => {
    const id = window.setTimeout(saveTransition, AUTOSAVE_MS)
    return () => window.clearTimeout(id)
  }, [transition])

  // Leaving the editor (Esc, a click outside, another slide) saves right away.
  useEffect(
    () => () => {
      saveScript()
      saveTransition()
    },
    [],
  )

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft])

  function onBlur(event: FocusEvent) {
    if (!containerRef.current?.contains(event.relatedTarget as Node | null)) onEdit(null)
  }

  return (
    <div
      ref={containerRef}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onEdit(null)
        }
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 md:px-5 md:py-4">
        <textarea
          ref={textareaRef}
          dir="ltr"
          lang="en"
          spellCheck
          autoFocus={field === 'script'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write what you will say on this slide…"
          aria-label="תסריט השקף"
          className="block w-full resize-none rounded-lg border border-accent/40 bg-paper px-3 py-2 text-[17px] leading-[1.65] focus:border-accent focus:outline-none md:text-[20px]"
        />
      </div>
      <label className="m-3 mt-0 block rounded-xl border-s-4 border-accent bg-accent-soft px-4 py-2.5" dir="ltr">
        <span className={`${kickerStyles} block text-accent`} lang="en">
          Before you click
        </span>
        <input
          lang="en"
          autoFocus={field === 'transition'}
          value={transition}
          onChange={(e) => setTransition(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEdit(null)
          }}
          placeholder="So where does this come from?"
          aria-label="משפט גשר לשקף הבא"
          className="mt-1 w-full bg-transparent text-[16px] font-medium placeholder:text-ink-faint focus:outline-none md:text-[18px]"
        />
      </label>
      <p className="px-4 pb-3 text-xs text-ink-faint">
        נשמר אוטומטית. <span dir="ltr">Esc</span> או לחיצה מחוץ לתסריט מסיימים עריכה.
      </p>
    </div>
  )
}

/** L3 waits for Gemini to pick keywords, or says why it could not. */
function KeywordsStatus({ keywords }: { keywords: SlideKeywords }) {
  if (keywords.error && !keywords.loading) {
    return (
      <p role="alert" className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-bad">
        <CircleAlert size={14} aria-hidden="true" />
        אין מילות מפתח: {keywords.error instanceof Error ? keywords.error.message : 'הבקשה נכשלה.'}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation() // a click in the script opens the editor
            keywords.retry()
          }}
          className="underline underline-offset-2"
        >
          נסה שוב
        </button>
      </p>
    )
  }
  return (
    <p role="status" className="mb-3 flex items-center gap-1.5 text-sm text-ink-faint">
      <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
      Gemini בוחר מילות מפתח… בינתיים <span dir="ltr">L2</span>.
    </p>
  )
}

function SaveBadge({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
        <LoaderCircle size={12} className="animate-spin" aria-hidden="true" />
        שומר…
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-good">
        <Check size={12} aria-hidden="true" />
        נשמר
      </span>
    )
  }
  if (status === 'error') {
    return (
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-xs text-bad underline-offset-2 hover:underline">
        <CircleAlert size={12} aria-hidden="true" />
        השמירה נכשלה · נסה שוב
      </button>
    )
  }
  return null
}
