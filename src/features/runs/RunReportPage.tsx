import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { Alert } from '../../components/Alert'
import { BackLink } from '../../components/BackLink'
import { En } from '../../components/En'
import { stagger } from '../../components/stagger'
import { cardStyles, kickerStyles } from '../../components/styles'
import { formatClock } from '../../lib/format'
import type { SlideTiming, TimingStatus } from '../../lib/metrics'
import { AiFeedback } from './AiFeedback'
import { useRecordingUrl, useRun, type RunDetail, type RunMetrics } from './api'
import { KEEP_RECORDINGS } from './retention'
import { TipsSection } from './TipsSection'

const dateTime = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function RunReportPage() {
  const { id: lectureId = '', runId = '' } = useParams()
  const { data: run, isPending, isError } = useRun(runId)

  if (isPending) {
    return (
      <p className="flex items-center gap-2 text-ink-soft">
        <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
        טוען את הדוח…
      </p>
    )
  }
  if (isError || !run || !run.metrics) {
    return (
      <div className="space-y-4">
        <BackLink to={`/lectures/${lectureId}`} label="להרצאה" />
        <Alert>{isError ? 'לא הצלחתי לטעון את הדוח. בדוק את החיבור ורענן.' : 'החזרה לא נמצאה.'}</Alert>
      </div>
    )
  }
  return <Report run={run} lectureId={lectureId} />
}

function Report({ run, lectureId }: { run: RunDetail; lectureId: string }) {
  const metrics = run.metrics as unknown as RunMetrics
  const onTrack = metrics.slides.filter((s) => s.status === 'on-track').length
  const target = metrics.targetSeconds

  return (
    <>
      <BackLink to={`/lectures/${lectureId}`} label="להרצאה" />
      <header className="mt-2 mb-8">
        <p className={`${kickerStyles} rise-in`}>
          <span dir="ltr" lang="en">
            Run report
          </span>
        </p>
        <h1 className="rise-in mt-2 font-display text-[32px] leading-tight font-semibold md:text-[42px]" style={stagger(1)}>
          חזרה · {dateTime.format(new Date(run.created_at))}
        </h1>
        <div className="mt-6 h-px bg-rule" />
      </header>

      <section className="rise-in grid grid-cols-2 gap-3" style={stagger(2)}>
        <Tile label="זמן כולל" tone={target ? totalTone(metrics.totalSeconds, target) : 'neutral'}>
          <span dir="ltr">{formatClock(metrics.totalSeconds)}</span>
          {target ? <Sub>יעד {formatClock(target)}</Sub> : null}
        </Tile>
        <Tile label="שקפים בזמן" tone={onTrack === metrics.slides.length ? 'good' : 'neutral'}>
          <span dir="ltr">
            {onTrack}/{metrics.slides.length}
          </span>
        </Tile>
      </section>

      <Recording path={run.audio_path} />

      <SlideTimes slides={metrics.slides} />

      <AiFeedback run={run} />

      <TipsSection run={run} />
    </>
  )
}

type Tone = 'good' | 'warn' | 'bad' | 'neutral'

const TONE_TEXT: Record<Tone, string> = { good: 'text-good', warn: 'text-warn', bad: 'text-bad', neutral: 'text-ink' }

function totalTone(total: number, target: number): Tone {
  const over = (total - target) / target
  if (Math.abs(over) <= 0.1) return 'good'
  return over > 0.2 ? 'bad' : 'warn'
}

function Tile({ label, tone, children }: { label: string; tone: Tone; children: ReactNode }) {
  return (
    <div className={`${cardStyles} p-4`}>
      <p className="text-sm text-ink-soft">{label}</p>
      <p className={`mt-1 font-mono text-[26px] leading-tight font-medium tabular-nums ${TONE_TEXT[tone]}`}>{children}</p>
    </div>
  )
}

function Sub({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 block font-sans text-xs font-normal text-ink-faint">{children}</span>
}

function Recording({ path }: { path: string | null }) {
  const { data: url, isError } = useRecordingUrl(path)
  return (
    <section className={`${cardStyles} rise-in mt-6 p-4`} style={stagger(3)}>
      <p className="mb-2 text-sm text-ink-soft">ההקלטה</p>
      {!path ? (
        <p className="text-sm leading-relaxed text-ink-faint">
          נמחקה אוטומטית: נשמרות רק ההקלטות של {KEEP_RECORDINGS} החזרות האחרונות. הדוח נשאר.
        </p>
      ) : isError ? (
        <p className="text-sm text-ink-faint">לא הצלחתי לטעון את ההקלטה. רענן את הדף.</p>
      ) : url ? (
        <audio controls preload="metadata" src={url} className="w-full" />
      ) : (
        <div className="h-[54px]" />
      )}
    </section>
  )
}

const STATUS: Record<TimingStatus, { label: string; className: string }> = {
  'on-track': { label: 'בזמן', className: 'bg-good-soft text-good' },
  long: { label: 'ארוך', className: 'bg-warn-soft text-warn' },
  short: { label: 'קצר', className: 'bg-accent-soft text-accent' },
  skipped: { label: 'דולג', className: 'bg-ink/5 text-ink-faint' },
}

function SlideTimes({ slides }: { slides: SlideTiming[] }) {
  const longest = Math.max(1, ...slides.map((s) => Math.max(s.seconds, s.plannedSeconds)))
  return (
    <section className="rise-in mt-8" style={stagger(5)}>
      <h2 className="mb-4 font-display text-xl font-semibold">זמן לכל שקף</h2>
      <ol className="grid grid-cols-1 gap-2">
        {slides.map((slide) => {
          const status = STATUS[slide.status]
          return (
            <li key={slide.position} className={`${cardStyles} p-3.5`}>
              <div className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-center font-mono text-sm text-ink-faint">{slide.position}</span>
                <En className="min-w-0 flex-1 truncate font-medium">{slide.title || 'Untitled slide'}</En>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
              </div>
              <div className="mt-2 flex items-center gap-3 ps-9">
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-rule" dir="ltr" aria-hidden="true">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-ink/15" style={{ width: `${(slide.plannedSeconds / longest) * 100}%` }} />
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${slide.status === 'long' ? 'bg-warn' : slide.status === 'on-track' ? 'bg-good' : 'bg-accent'}`}
                    style={{ width: `${(slide.seconds / longest) * 100}%`, opacity: 0.85 }}
                  />
                </div>
                <span className="shrink-0 text-xs text-ink-soft">
                  <span dir="ltr" className="font-mono">
                    {formatClock(slide.seconds)}
                  </span>{' '}
                  / תכנון{' '}
                  <span dir="ltr" className="font-mono">
                    {formatClock(slide.plannedSeconds)}
                  </span>
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
