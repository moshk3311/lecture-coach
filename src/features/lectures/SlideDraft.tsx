import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, LoaderCircle, Pencil, X } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '../../components/Alert'
import { En } from '../../components/En'
import { buttonStyles, inputStyles } from '../../components/styles'
import { formatClock } from '../../lib/format'
import { joinScript } from '../../lib/script'
import { llm, type ScriptDraft } from '../../providers'
import type { SlideWithSentences } from './api'
import { hasScript, saveDraft, saveIntent } from './draft'

/** The pencil of a slide: the speaker's intent in, a proposed script out, accepted or not (§5.1). */
export function SlideDraft({ lectureId, slide }: { lectureId: string; slide: SlideWithSentences }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [intent, setIntent] = useState(slide.intent_notes ?? '')
  const [draft, setDraft] = useState<ScriptDraft | null>(null)

  const propose = useMutation({
    mutationFn: async () => {
      await saveIntent(queryClient, lectureId, slide, intent).catch(() => undefined) // the draft does not depend on it
      return llm.draftScript({ slideId: slide.id, intent })
    },
    onSuccess: setDraft,
  })
  const accept = useMutation({
    mutationFn: (proposal: ScriptDraft) => saveDraft(queryClient, lectureId, slide, proposal, true),
    onSuccess: () => {
      setDraft(null)
      setOpen(false)
    },
  })

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${buttonStyles.ghost} -ms-3 h-9 text-sm`}>
        <Pencil size={15} aria-hidden="true" />
        הצע מלל
      </button>
    )
  }

  const busy = propose.isPending || accept.isPending
  const failure = propose.error ?? accept.error
  return (
    <div className="mt-3 border-t border-rule pt-3">
      <label className="block text-sm text-ink-soft" htmlFor={`intent-${slide.id}`}>
        מה חשוב לך להגיד בשקף הזה? (אפשר בעברית, אפשר להשאיר ריק)
      </label>
      <textarea
        id={`intent-${slide.id}`}
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        rows={2}
        disabled={busy}
        className={`${inputStyles} mt-1.5 h-auto py-2.5`}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => propose.mutate()} className={`${buttonStyles.primary} h-10 text-sm`}>
          {propose.isPending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Pencil size={16} aria-hidden="true" />}
          {propose.isPending ? 'מנסח…' : draft ? 'נסח שוב' : 'הצע מלל'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false)
            setDraft(null)
          }}
          className={`${buttonStyles.ghost} h-10 text-sm`}
        >
          סגור
        </button>
      </div>

      {failure ? (
        <div className="mt-3">
          <Alert>{failure instanceof Error && failure.message ? failure.message : 'הניסוח נכשל. נסה שוב.'}</Alert>
        </div>
      ) : null}

      {draft ? <Proposal slide={slide} draft={draft} busy={busy} onAccept={() => accept.mutate(draft)} onDismiss={() => setDraft(null)} /> : null}
    </div>
  )
}

function Proposal({
  slide,
  draft,
  busy,
  onAccept,
  onDismiss,
}: {
  slide: SlideWithSentences
  draft: ScriptDraft
  busy: boolean
  onAccept: () => void
  onDismiss: () => void
}) {
  const current = joinScript(slide.sentences)
  const budget = draft.budget_seconds
  const fits = budget === null || Math.abs(draft.estimated_seconds - budget) <= budget * 0.25
  return (
    <div className="mt-4 rounded-xl border border-accent/30 bg-accent-soft/40 p-4">
      <p className="text-xs text-ink-faint">
        {draft.saw_image ? 'Gemini ראה את השקף ואת הטקסט שלו.' : 'Gemini ראה רק את הטקסט והערות הדובר. להוספת תמונות השקפים, העלה PDF של המצגת.'}
      </p>
      <En as="p" className="mt-3 text-[16px] leading-relaxed whitespace-pre-line">
        {draft.script_en}
      </En>
      {draft.transition_line ? (
        <p className="mt-3 rounded-lg border-s-4 border-accent bg-card px-3 py-2 text-sm">
          <span className="text-xs text-ink-faint">לפני שלוחצים: </span>
          <En className="font-medium">{draft.transition_line}</En>
        </p>
      ) : null}
      <p className={`mt-3 text-sm ${fits ? 'text-ink-soft' : 'text-warn'}`}>
        <span dir="ltr" className="font-mono">
          {draft.words}
        </span>{' '}
        מילים · כ-<span dir="ltr">{formatClock(draft.estimated_seconds)}</span>
        {budget !== null ? (
          <>
            {' '}
            מול <span dir="ltr">{formatClock(budget)}</span> מתוכנן{fits ? '' : ': כדאי לקצר או להאריך'}
          </>
        ) : null}
      </p>
      {draft.notes_he ? <p className="mt-2 text-sm leading-relaxed text-ink-soft">{draft.notes_he}</p> : null}
      {current ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-soft">התסריט הנוכחי (יוחלף אם תקבל)</summary>
          <En as="p" className="mt-2 leading-relaxed whitespace-pre-line text-ink-soft">
            {current}
          </En>
        </details>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={onAccept} className={`${buttonStyles.primary} h-10 text-sm`}>
          <Check size={16} aria-hidden="true" />
          {hasScript(slide) ? 'החלף את התסריט' : 'קבל'}
        </button>
        <button type="button" disabled={busy} onClick={onDismiss} className={`${buttonStyles.secondary} h-10 text-sm`}>
          <X size={16} aria-hidden="true" />
          דחה
        </button>
      </div>
    </div>
  )
}

