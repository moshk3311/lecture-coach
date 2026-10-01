import { CircleAlert, Download, LoaderCircle, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { buttonStyles, cardStyles } from '../../components/styles'
import { encodeWav } from '../../audio/wav'
import { formatClock } from '../../lib/format'
import { buildRunTiming } from '../../lib/metrics'
import { joinScript } from '../../lib/script'
import type { LectureDeck } from '../lectures/api'
import { discardTakeAudio, useSaveTake } from '../runs/api'
import type { SlideWindow } from './plan'
import type { FinishedTake } from './useTake'

type TakeSaveDialogProps = {
  deck: LectureDeck
  take: FinishedTake
  windows: SlideWindow[]
  onDiscard: () => void
}

/** Saves a finished take (audio + timing) and opens its report; on failure the audio stays safe. */
export function TakeSaveDialog({ deck, take, windows, onDiscard }: TakeSaveDialogProps) {
  const navigate = useNavigate()
  const save = useSaveTake()
  const [attemptId] = useState(() => crypto.randomUUID())
  const started = useRef(false)

  function run() {
    save.mutate(
      {
        attemptId,
        userId: deck.user_id,
        lectureId: deck.id,
        recording: take.recording,
        referenceText: deck.slides.map((s) => joinScript(s.sentences)).filter(Boolean).join('\n'),
        timing: buildRunTiming(
          take.marks,
          take.recording.durationSec,
          deck.slides.map((s) => ({ position: s.position, title: s.title })),
          windows,
          deck.target_minutes ? deck.target_minutes * 60 : null,
        ),
      },
      { onSuccess: (id) => void navigate(`/lectures/${deck.id}/runs/${id}`) },
    )
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    run()
  })

  function discard() {
    if (!window.confirm('למחוק את ההקלטה של החזרה הזו?')) return
    // The upload may have worked before the save failed: don't leave the file behind.
    void discardTakeAudio(deck.user_id, attemptId).catch(() => undefined)
    onDiscard()
  }

  function download() {
    const url = URL.createObjectURL(new Blob([encodeWav(take.recording.pcm, take.recording.sampleRate)], { type: 'audio/wav' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `take-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.wav`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="take-title">
      <section className={`${cardStyles} w-full max-w-md p-6`}>
        <h2 id="take-title" className="font-display text-xl font-semibold">
          החזרה הסתיימה
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          אורך ההקלטה{' '}
          <span dir="ltr" className="font-mono">
            {formatClock(take.recording.durationSec)}
          </span>
        </p>
        {take.stoppedAtLimit ? (
          <p className="mt-3 text-sm text-warn">ההקלטה נעצרה אוטומטית בגלל מגבלת הגודל של קובץ בשרת (כ-27 דקות).</p>
        ) : null}

        {save.isError ? (
          <>
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-bad/25 bg-bad-soft px-3 py-2.5 text-sm text-bad" role="alert">
              <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              השמירה נכשלה. ההקלטה עדיין כאן: נסה שוב, או הורד אותה כדי לא לאבד אותה.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={run} className={buttonStyles.primary}>
                <RotateCcw size={16} aria-hidden="true" />
                נסה שוב
              </button>
              <button type="button" onClick={download} className={buttonStyles.secondary}>
                <Download size={16} aria-hidden="true" />
                הורד הקלטה
              </button>
              <button type="button" onClick={discard} className={`${buttonStyles.ghost} hover:text-bad`}>
                <Trash2 size={16} aria-hidden="true" />
                מחק
              </button>
            </div>
          </>
        ) : (
          <p className="mt-5 flex items-center gap-2 text-ink-soft" role="status">
            <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
            שומר את ההקלטה ופותח את הדוח…
          </p>
        )}
      </section>
    </div>
  )
}
