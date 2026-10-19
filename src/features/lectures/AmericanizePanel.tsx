import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, LoaderCircle, RotateCcw, X } from 'lucide-react'
import { Alert } from '../../components/Alert'
import { En } from '../../components/En'
import { MixedText } from '../../components/MixedText'
import { buttonStyles } from '../../components/styles'
import { joinScript } from '../../lib/script'
import { wordDiff } from '../../lib/wordDiff'
import { llm, type AmericanizeResult } from '../../providers'
import type { SlideWithSentences } from './api'
import { saveScript } from './draft'

/** "Americanize" a slide's saved script (§5.1): Gemini's revision as a word diff with Hebrew reasons, accepted or not. */
export function AmericanizePanel({ lectureId, slide, onClose }: { lectureId: string; slide: SlideWithSentences; onClose: () => void }) {
  const queryClient = useQueryClient()
  const text = joinScript(slide.sentences)
  const bridge = slide.transition_line?.trim() || null
  const revision = useQuery({
    queryKey: ['americanize', slide.id, text, bridge],
    queryFn: () => llm.americanize({ text, transitionLine: bridge }),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  })
  const accept = useMutation({
    mutationFn: (result: AmericanizeResult) =>
      saveScript(queryClient, lectureId, slide, { text: result.text_en, transitionLine: result.transition_line }, true),
    onSuccess: onClose,
  })

  const closeButton = (
    <button type="button" disabled={accept.isPending} onClick={onClose} className={`${buttonStyles.ghost} h-10 text-sm`}>
      סגור
    </button>
  )

  if (revision.isPending) {
    return (
      <div className="mt-3 flex items-center gap-2 border-t border-rule pt-3 text-sm text-ink-soft" role="status">
        <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
        בודק את הניסוח…
      </div>
    )
  }
  if (revision.isError) {
    return (
      <div className="mt-3 border-t border-rule pt-3">
        <Alert>{revision.error.message || 'התיקון נכשל. נסה שוב.'}</Alert>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void revision.refetch()} className={`${buttonStyles.secondary} h-10 text-sm`}>
            <RotateCcw size={16} aria-hidden="true" />
            נסה שוב
          </button>
          {closeButton}
        </div>
      </div>
    )
  }

  const result = revision.data
  const sameText = result.text_en === text && result.transition_line === bridge
  if (sameText) {
    return (
      <div className="mt-3 border-t border-rule pt-3">
        <p className="text-sm text-good">התסריט כבר נשמע טבעי באנגלית אמריקאית. אין מה לשנות.</p>
        <div className="mt-2">{closeButton}</div>
      </div>
    )
  }

  return (
    <div className="mt-3 border-t border-rule pt-3">
      <div className="rounded-xl border border-accent/30 bg-accent-soft/40 p-4">
        <p className="text-xs text-ink-faint">
          <del className="text-bad">מחוק</del> · <ins className="font-medium text-good no-underline">נוסף</ins>
        </p>
        <Diff before={text} after={result.text_en} className="mt-2 text-[16px] leading-relaxed" />
        {bridge && result.transition_line && result.transition_line !== bridge ? (
          <div className="mt-3 rounded-lg border-s-4 border-accent bg-card px-3 py-2 text-sm">
            <span className="text-xs text-ink-faint">לפני שלוחצים: </span>
            <Diff before={bridge} after={result.transition_line} />
          </div>
        ) : null}

        {result.changes.length ? (
          <ul className="mt-4 space-y-2.5 text-sm" aria-label="השינויים">
            {result.changes.map((change) => (
              <li key={`${change.from}→${change.to}`}>
                <En className="font-medium">
                  <del className="text-bad">{change.from}</del>
                  {change.to ? (
                    <>
                      {' → '}
                      <ins className="text-good no-underline">{change.to}</ins>
                    </>
                  ) : null}
                </En>
                <p className="mt-0.5 leading-relaxed text-ink-soft">
                  <MixedText text={change.reason_he} />
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {accept.error ? (
          <div className="mt-3">
            <Alert>{accept.error.message || 'השמירה נכשלה. נסה שוב.'}</Alert>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={accept.isPending} onClick={() => accept.mutate(result)} className={`${buttonStyles.primary} h-10 text-sm`}>
            {accept.isPending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
            קבל את התיקונים
          </button>
          <button type="button" disabled={accept.isPending} onClick={onClose} className={`${buttonStyles.secondary} h-10 text-sm`}>
            <X size={16} aria-hidden="true" />
            דחה
          </button>
        </div>
      </div>
    </div>
  )
}

/** English text with removed words struck through and added words marked, paragraph breaks kept. */
function Diff({ before, after, className }: { before: string; after: string; className?: string }) {
  return (
    <En as="p" className={className}>
      {wordDiff(before, after).map((part, i, parts) => {
        if (part.text === '\n') return <br key={i} />
        const space = i > 0 && parts[i - 1]?.text !== '\n' ? ' ' : ''
        if (part.kind === 'removed') {
          return (
            <span key={i}>
              {space}
              <del className="text-bad decoration-bad/60">{part.text}</del>
            </span>
          )
        }
        if (part.kind === 'added') {
          return (
            <span key={i}>
              {space}
              <ins className="rounded bg-good-soft px-0.5 font-medium text-good no-underline">{part.text}</ins>
            </span>
          )
        }
        return <span key={i}>{space + part.text}</span>
      })}
    </En>
  )
}
