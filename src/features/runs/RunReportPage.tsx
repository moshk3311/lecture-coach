import { LoaderCircle, Sparkles, Wand2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { Alert } from '../../components/Alert'
import { BackLink } from '../../components/BackLink'
import { En } from '../../components/En'
import { stagger } from '../../components/stagger'
import { buttonStyles, cardStyles, kickerStyles } from '../../components/styles'
import { formatClock } from '../../lib/format'
import { WPM_BAND, type SlideTiming, type TimingStatus } from '../../lib/metrics'
import { scoreBand } from '../../lib/scoreBands'
import { useRecordingUrl, useRun, type RunDetail, type RunMetrics } from './api'
import { useAssessRun } from './assess'
import { KEEP_RECORDINGS } from './retention'

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
  const speech = metrics.speech
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

      <section className="rise-in grid grid-cols-2 gap-3 md:grid-cols-4" style={stagger(2)}>
        <Tile label="זמן כולל" tone={target ? totalTone(metrics.totalSeconds, target) : 'neutral'}>
          <span dir="ltr">{formatClock(metrics.totalSeconds)}</span>
          {target ? <Sub>יעד {formatClock(target)}</Sub> : null}
        </Tile>
        <Tile label="שקפים בזמן" tone={onTrack === metrics.slides.length ? 'good' : 'neutral'}>
          <span dir="ltr">
            {onTrack}/{metrics.slides.length}
          </span>
        </Tile>
        <Tile label="קצב" tone={speech?.wpm ? (speech.wpm >= WPM_BAND.min && speech.wpm <= WPM_BAND.max ? 'good' : 'warn') : 'neutral'}>
          {speech?.wpm ? <span dir="ltr">{speech.wpm}</span> : '—'}
          <Sub>
            מילים לדקה · יעד {WPM_BAND.min}–{WPM_BAND.max}
          </Sub>
        </Tile>
        <Tile label="הגייה" tone={run.pron_score === null ? 'neutral' : scoreBand(run.pron_score)}>
          {run.pron_score === null ? '—' : <span dir="ltr">{Math.round(run.pron_score)}</span>}
          <Sub>{run.pron_score !== null ? 'מתוך 100' : run.audio_path ? 'אחרי הערכה' : 'לא הוערכה'}</Sub>
        </Tile>
      </section>

      <Recording path={run.audio_path} />

      {speech ? <SpeechDetails run={run} metrics={metrics} /> : run.audio_path ? <AssessPanel run={run} /> : null}

      <SlideTimes slides={metrics.slides} perSlideWpm={speech?.perSlide} />

      <section className={`${cardStyles} rise-in mt-6 p-5 md:p-6`} style={stagger(6)}>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Sparkles size={18} className="text-accent" aria-hidden="true" />
          משוב AI ותיקונים
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          משוב על טון ואנרגיה ותיקוני &quot;איך אמריקאים אומרים את זה&quot; יופיעו כאן אחרי שיוגדר מפתח Gemini.
        </p>
      </section>
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
          נמחקה אוטומטית: נשמרות רק ההקלטות של {KEEP_RECORDINGS} החזרות האחרונות. הדוח והציונים נשארים.
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

function AssessPanel({ run }: { run: RunDetail }) {
  const assess = useAssessRun()
  const [seconds, setSeconds] = useState(0)
  const total = Number(run.duration_sec)

  return (
    <section className={`${cardStyles} rise-in mt-6 p-5 md:p-6`} style={stagger(4)}>
      <h2 className="font-display text-lg font-semibold">הערכת הגייה</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">
        Azure מאזין להקלטה ומחזיר ציון לכל מילה, קצב, הפסקות, מילות מילוי וכמה מהתסריט נאמר. ההערכה צורכת כ-
        {Math.ceil(total / 60)} דקות מהמכסה החודשית.
      </p>
      {assess.isError ? (
        <div className="mt-4">
          <Alert>{assess.error instanceof Error && assess.error.message ? assess.error.message : 'ההערכה נכשלה.'}</Alert>
        </div>
      ) : null}
      {assess.isPending ? (
        <div className="mt-4" role="status">
          <p className="text-sm text-ink-soft">
            מעריך… <span dir="ltr">{formatClock(seconds)}</span> מתוך <span dir="ltr">{formatClock(total)}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rule">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.min(100, (seconds / total) * 100)}%` }} />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => assess.mutate({ attempt: run, onProgress: setSeconds })}
          className={`${buttonStyles.primary} mt-4`}
        >
          <Wand2 size={18} aria-hidden="true" />
          {assess.isError ? 'נסה שוב' : 'הרץ הערכה'}
        </button>
      )}
    </section>
  )
}

function SpeechDetails({ run, metrics }: { run: RunDetail; metrics: RunMetrics }) {
  const speech = metrics.speech!
  const scores: [string, number | null][] = [
    ['Pronunciation', run.pron_score],
    ['Accuracy', run.accuracy],
    ['Fluency', run.fluency],
    ['Prosody', run.prosody],
  ]
  return (
    <section className={`${cardStyles} rise-in mt-6 p-5 md:p-6`} style={stagger(4)}>
      <h2 className="font-display text-lg font-semibold">הגייה ודיבור</h2>
      <En as="div" className="mt-3 flex flex-wrap gap-2">
        {scores.map(([name, value]) => (
          <span key={name} className="rounded-full border border-rule px-3 py-1 font-mono text-sm">
            {name}{' '}
            <span className={value === null ? 'text-ink-faint' : TONE_TEXT[scoreBand(value)]}>{value === null ? '—' : Math.round(value)}</span>
          </span>
        ))}
      </En>
      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <Row label="מילות מילוי">
          {speech.fillers} (<span dir="ltr">{speech.fillersPerMinute}</span> לדקה)
        </Row>
        <Row label="הפסקות ארוכות (מעל 1.5 שנ׳)">
          {speech.pauses.long} · הארוכה <span dir="ltr">{(speech.pauses.longestMs / 1000).toFixed(1)}</span> שנ׳
        </Row>
        <Row label="כיסוי התסריט">
          <span dir="ltr">{Math.round(speech.coverage.ratio * 100)}%</span>
        </Row>
        <Row label="מילים שלא נאמרו">{speech.coverage.omitted.length}</Row>
      </dl>
      {speech.weakest.length ? (
        <div className="mt-5">
          <p className="text-sm text-ink-soft">המילים החלשות</p>
          <En as="ul" className="mt-2 flex flex-wrap gap-2">
            {speech.weakest.map((w) => (
              <li key={w.word} className="rounded-lg bg-bad-soft px-2.5 py-1 text-sm">
                {w.word} <span className="font-mono text-bad">{Math.round(w.accuracy)}</span>
              </li>
            ))}
          </En>
        </div>
      ) : null}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5">
      <dt className="text-ink-soft">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

const STATUS: Record<TimingStatus, { label: string; className: string }> = {
  'on-track': { label: 'בזמן', className: 'bg-good-soft text-good' },
  long: { label: 'ארוך', className: 'bg-warn-soft text-warn' },
  short: { label: 'קצר', className: 'bg-accent-soft text-accent' },
  skipped: { label: 'דולג', className: 'bg-ink/5 text-ink-faint' },
}

function SlideTimes({ slides, perSlideWpm }: { slides: SlideTiming[]; perSlideWpm?: { position: number; wpm: number | null }[] }) {
  const longest = Math.max(1, ...slides.map((s) => Math.max(s.seconds, s.plannedSeconds)))
  return (
    <section className="rise-in mt-8" style={stagger(5)}>
      <h2 className="mb-4 font-display text-xl font-semibold">זמן לכל שקף</h2>
      <ol className="grid grid-cols-1 gap-2">
        {slides.map((slide) => {
          const wpm = perSlideWpm?.find((p) => p.position === slide.position)?.wpm
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
                  {wpm ? (
                    <>
                      {' '}
                      · <span dir="ltr">{wpm}</span> מ׳/ד׳
                    </>
                  ) : null}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
