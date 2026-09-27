import { ChevronLeft, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router'
import { stagger } from '../../components/stagger'
import { cardStyles } from '../../components/styles'
import { formatClock } from '../../lib/format'
import type { RunTiming } from '../../lib/metrics'
import { scoreBand } from '../../lib/scoreBands'
import { useLectureRuns } from './api'

const dateTime = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const BAND_TEXT = { good: 'text-good', warn: 'text-warn', bad: 'text-bad' } as const

/** Full-run takes of a lecture, newest first (ARCHITECTURE §5.7 run history). */
export function RunHistory({ lectureId }: { lectureId: string }) {
  const { data: runs, isPending } = useLectureRuns(lectureId)
  if (isPending) {
    return (
      <p className="mt-8 flex items-center gap-2 text-sm text-ink-soft">
        <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
        טוען חזרות…
      </p>
    )
  }
  if (!runs?.length) return null

  return (
    <section className="rise-in mt-8" style={stagger(5)}>
      <h2 className="mb-4 font-display text-xl font-semibold">חזרות מוקלטות</h2>
      <ul className="grid grid-cols-1 gap-2">
        {runs.map((run) => {
          const timing = run.metrics as unknown as RunTiming | null
          const onTrack = timing?.slides.filter((s) => s.status === 'on-track').length
          return (
            <li key={run.id}>
              <Link
                to={`/lectures/${lectureId}/runs/${run.id}`}
                className={`${cardStyles} group flex items-center gap-3 p-4 transition hover:border-ink-faint`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{dateTime.format(new Date(run.created_at))}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-ink-soft">
                    <span>
                      <span dir="ltr" className="font-mono">
                        {formatClock(Number(run.duration_sec))}
                      </span>
                    </span>
                    {timing ? (
                      <span>
                        {onTrack}/{timing.slides.length} שקפים בזמן
                      </span>
                    ) : null}
                    {run.wpm ? <span dir="ltr">{Math.round(Number(run.wpm))} WPM</span> : null}
                  </p>
                </div>
                {run.pron_score !== null ? (
                  <span className={`font-mono text-lg ${BAND_TEXT[scoreBand(Number(run.pron_score))]}`}>{Math.round(Number(run.pron_score))}</span>
                ) : (
                  <span className="text-xs text-ink-faint">בלי הערכה</span>
                )}
                <ChevronLeft size={18} className="shrink-0 text-ink-faint" aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
