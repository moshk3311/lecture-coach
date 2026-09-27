import {
  ArrowLeft,
  ArrowRight,
  CircleDot,
  LoaderCircle,
  Download,
  Eye,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Square,
  Undo2,
  X,
} from 'lucide-react'
import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Splash } from '../../app/Splash'
import { Alert } from '../../components/Alert'
import { En } from '../../components/En'
import { SlideFrame } from '../../components/SlideFrame'
import { buttonStyles, kickerStyles } from '../../components/styles'
import { formatClock } from '../../lib/format'
import { countWords, joinScript } from '../../lib/script'
import { useLectureDeck, useSlideImageUrls, useUpdateSlide, type LectureDeck } from '../lectures/api'
import { useMonthUsage } from '../runs/api'
import { quotaState } from '../runs/quota'
import { useScriptSaver } from './api'
import { scriptFileName, scriptMarkdown } from './exportScript'
import { useFlash, useNow, useStopwatch, useWakeLock } from './hooks'
import { MEMO_LEVELS, nextMemoLevel, toMemoLevel, type MemoLevel } from './memo'
import { planWindows, timerStatus, type SlideWindow, type TimerStatus } from './plan'
import { ScriptPane, type EditField } from './ScriptPane'
import { TakeSaveDialog } from './TakeSaveDialog'
import { useTake, type Take } from './useTake'

/** "Peek" shows the full script this long. */
const PEEK_MS = 3000
/** A swipe is a mostly horizontal move of at least this many pixels. */
const SWIPE_PX = 60

export function PresenterPage() {
  const { lectureId = '' } = useParams()
  const { data: deck, isPending, isError } = useLectureDeck(lectureId)

  if (isPending) return <Splash />
  if (isError || !deck || deck.slides.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-5 py-12">
        <Alert>
          {isError
            ? 'לא הצלחתי לטעון את ההרצאה. בדוק את החיבור ונסה שוב.'
            : !deck
              ? 'ההרצאה לא נמצאה.'
              : 'להרצאה הזו עוד אין שקפים. ייבא מצגת בעמוד ההרצאה.'}
        </Alert>
        <Link to={deck ? `/lectures/${deck.id}` : '/'} className={buttonStyles.secondary}>
          חזרה
        </Link>
      </div>
    )
  }
  return <PresenterView deck={deck} />
}

function PresenterView({ deck }: { deck: LectureDeck }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const count = deck.slides.length
  // Local state leads and the URL (?slide=n, for reloads) follows: router updates run as
  // transitions, so two quick clicker presses would otherwise read the same slide.
  const [index, setIndex] = useState(() => clamp(Number(searchParams.get('slide') ?? 1) - 1, count))
  useEffect(() => {
    setSearchParams({ slide: String(index + 1) }, { replace: true })
  }, [index, setSearchParams])
  const slide = deck.slides[index]!
  const slidePosition = slide.position
  const next = deck.slides[index + 1]

  const { data: urls } = useSlideImageUrls(deck)
  const imageUrl = (path: string | null) => (path ? urls?.get(path) : null)
  const stopwatch = useStopwatch()
  const now = useNow(1000)
  useWakeLock()
  const saver = useScriptSaver(deck.id)
  const take = useTake()
  const recording = take.phase === 'recording' || take.phase === 'starting'
  const { data: usage } = useMonthUsage()
  const quota = usage ? quotaState(usage.minutes, usage.cap) : 'ok'
  const updateSlide = useUpdateSlide(deck.id)
  const [editing, setEditing] = useState<EditField | null>(null)
  const [peeking, peek] = useFlash(PEEK_MS)

  const scripts = useMemo(
    () => deck.slides.map((s) => saver.unsaved[s.id] ?? joinScript(s.sentences)),
    [deck.slides, saver.unsaved],
  )
  const windows = useMemo(
    () =>
      planWindows(
        deck.slides.map((s, i) => ({ words: countWords(scripts[i] ?? ''), plannedSeconds: s.planned_seconds })),
        deck.target_minutes ? deck.target_minutes * 60 : null,
      ),
    [deck.slides, deck.target_minutes, scripts],
  )
  // What "Revert slide" goes back to: each slide as it was when the presenter view opened.
  const [snapshot] = useState(
    () => new Map(deck.slides.map((s) => [s.id, { script: joinScript(s.sentences), transition: s.transition_line ?? '' }])),
  )

  const level = toMemoLevel(slide.memo_level)
  const hasKeywords = (slide.keywords?.length ?? 0) > 0
  const original = snapshot.get(slide.id)
  const changed =
    original !== undefined && (scripts[index] !== original.script || (slide.transition_line ?? '') !== original.transition)
  const elapsed = stopwatch.elapsedMs / 1000
  const status = timerStatus(elapsed, windows[index], stopwatch.started)

  function go(target: number | ((current: number) => number)) {
    setEditing(null)
    setIndex((current) => clamp(typeof target === 'function' ? target(current) : target, count))
  }
  const goNext = () => go((i) => i + 1)
  const goBack = () => go((i) => i - 1)

  // Every slide change during a take is timestamped on the audio clock.
  const { markSlide } = take
  useEffect(() => {
    markSlide(slidePosition)
  }, [slidePosition, markSlide])

  // Record take (§5.7): the timer and the recording start together; stopping opens the save step.
  function toggleTake() {
    if (take.phase === 'recording') {
      take.stop()
      stopwatch.pause()
    } else if (take.phase === 'idle' && !take.finished && quota !== 'blocked') {
      take.start(slidePosition)
      stopwatch.restart()
    }
  }

  function setLevel(memoLevel: MemoLevel) {
    if (memoLevel !== level) updateSlide.mutate({ id: slide.id, patch: { memo_level: memoLevel } })
  }

  function revert() {
    if (!original) return
    saver.save(slide.id, original.script)
    if ((slide.transition_line ?? '') !== original.transition) {
      updateSlide.mutate({ id: slide.id, patch: { transition_line: original.transition || null } })
    }
  }

  function exportScript() {
    const markdown = scriptMarkdown(
      deck.title,
      deck.slides.map((s, i) => ({ position: s.position, title: s.title, script: scripts[i] ?? '', transitionLine: s.transition_line })),
    )
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = scriptFileName(deck.title)
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Keyboard and clicker (clickers send PageDown / PageUp). Letters use the physical key, so the
  // shortcuts also work with a Hebrew keyboard layout.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    const target = event.target instanceof HTMLElement ? event.target : null
    if (target?.closest('textarea, input, select, [contenteditable="true"]')) return
    if (event.key === ' ' && target?.closest('button, a')) return
    const byKey: Record<string, () => void> = {
      ArrowRight: goNext,
      PageDown: goNext,
      ' ': goNext,
      ArrowLeft: goBack,
      PageUp: goBack,
      Home: () => go(0),
      End: () => go(count - 1),
    }
    const byCode: Record<string, () => void> = {
      KeyT: stopwatch.toggle,
      KeyM: () => setLevel(nextMemoLevel(level, hasKeywords)),
      KeyP: peek,
      KeyE: () => setEditing('script'),
      KeyR: toggleTake,
    }
    if (event.key === 'Escape' && take.phase === 'recording') byKey.Escape = toggleTake
    const action = byKey[event.key] ?? (event.repeat ? undefined : byCode[event.code])
    if (!action) return
    event.preventDefault()
    action()
  })
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const touchStart = useRef<{ x: number; y: number } | null>(null)
  function onTouchStart(event: TouchEvent) {
    const touch = event.touches[0]
    touchStart.current = editing || event.touches.length !== 1 || !touch ? null : { x: touch.clientX, y: touch.clientY }
  }
  function onTouchEnd(event: TouchEvent) {
    const start = touchStart.current
    const touch = event.changedTouches[0]
    touchStart.current = null
    if (!start || !touch) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > 1.5 * Math.abs(dy)) (dx < 0 ? goNext : goBack)()
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-paper">
      <header className="flex items-center gap-1.5 border-b border-rule bg-card/85 px-2 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] backdrop-blur md:gap-3 md:px-4 md:py-2">
        <Link
          to={`/lectures/${deck.id}`}
          onClick={(e) => {
            if (recording && !window.confirm('יש הקלטה פעילה. לצאת בלי לשמור אותה?')) e.preventDefault()
          }}
          aria-label="יציאה ממצב מציג"
          title="יציאה"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-ink/5 hover:text-ink"
        >
          <X size={20} aria-hidden="true" />
        </Link>
        <p className="flex min-w-0 flex-1 items-baseline gap-2">
          <span dir="ltr" className="shrink-0 font-mono text-sm text-ink-soft">
            {index + 1}/{count}
          </span>
          <En className="truncate font-medium">{slide.title || 'Untitled slide'}</En>
        </p>
        <TakeButton take={take} quota={quota} usage={usage} onToggle={toggleTake} />
        <TimerPill stopwatch={stopwatch} status={status} />
        <PlanLabel window={windows[index]} />
        <span dir="ltr" className="hidden font-mono text-sm text-ink-soft md:block" title="שעה">
          {now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <FullscreenButton />
      </header>

      {take.error ? (
        <p role="alert" className="border-b border-bad/25 bg-bad-soft px-4 py-2 text-sm text-bad">
          {take.error}
        </p>
      ) : null}
      {take.finished ? (
        <TakeSaveDialog deck={deck} take={take.finished} windows={windows} onDiscard={take.discard} />
      ) : null}

      <main
        dir="ltr"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="flex min-h-0 flex-1 flex-col gap-3 p-3 landscape:grid landscape:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] md:gap-4 md:p-4"
      >
        <section className="flex shrink-0 flex-col landscape:h-full landscape:min-h-0" aria-label="השקף הנוכחי">
          <p className={`${kickerStyles} mb-2 hidden md:block [@media(max-height:560px)]:hidden`} lang="en">
            Now on screen
          </p>
          <div className="grid place-items-center landscape:relative landscape:min-h-0 landscape:flex-1 landscape:[container-type:size]">
            <SlideFrame
              size="large"
              imageUrl={imageUrl(slide.image_path)}
              title={slide.title}
              text={slide.source_text}
              className="w-full shadow-[0_12px_32px_-18px_rgb(29_27_23/0.35)] landscape:w-[min(100cqw,calc(100cqh*16/9))]"
            />
          </div>
        </section>

        <aside dir="rtl" className="flex min-h-0 flex-1 flex-col gap-3">
          <NextSlide next={next} imageUrl={next ? imageUrl(next.image_path) : null} />
          <ScriptPane
            key={slide.id}
            slide={slide}
            script={scripts[index] ?? ''}
            level={level}
            peeking={peeking}
            editing={editing}
            saveStatus={saver.status[slide.id] ?? 'idle'}
            onEdit={setEditing}
            onSaveScript={(text) => saver.save(slide.id, text)}
            onSaveTransition={(text) =>
              updateSlide.mutate({ id: slide.id, patch: { transition_line: text.trim() || null } })
            }
            onRetry={() => saver.retry(slide.id)}
          />
        </aside>
      </main>

      <footer className="border-t border-rule bg-card/85 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:px-4">
        <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
          <div dir="ltr" className="flex gap-1.5">
            <ControlButton icon={<ArrowLeft size={18} />} label="הקודם" onClick={goBack} disabled={index === 0} />
            <ControlButton
              icon={<ArrowRight size={18} />}
              label="הבא"
              onClick={goNext}
              disabled={index === count - 1}
              primary
            />
          </div>
          <MemoControl level={level} hasKeywords={hasKeywords} onChange={setLevel} />
          <ControlButton icon={<Eye size={18} />} label="הצצה" onClick={peek} disabled={level === 0} active={peeking} />
          <div className="ms-auto flex gap-1.5">
            <ControlButton
              icon={<Undo2 size={18} />}
              label="שחזר שקף"
              onClick={revert}
              disabled={!changed || editing !== null}
              title="מחזיר את התסריט של השקף למה שהיה כשנכנסת למצב מציג"
            />
            <ControlButton icon={<Download size={18} />} label="ייצוא תסריט" onClick={exportScript} />
          </div>
        </div>
        <KeyHints />
      </footer>
    </div>
  )
}

function clamp(index: number, count: number): number {
  if (!Number.isFinite(index)) return 0
  return Math.min(count - 1, Math.max(0, Math.trunc(index)))
}

const STATUS_STYLES: Record<TimerStatus, string> = {
  idle: 'bg-ink/5 text-ink',
  ahead: 'bg-accent-soft text-accent',
  'on-time': 'bg-good-soft text-good',
  over: 'bg-warn-soft text-warn',
  late: 'bg-bad-soft text-bad',
}

const STATUS_LABELS: Record<TimerStatus, string> = {
  idle: 'הטיימר לא רץ',
  ahead: 'מקדים את התכנון',
  'on-time': 'בזמן',
  over: 'חורג מעט מהתכנון',
  late: 'באיחור',
}

function TimerPill({ stopwatch, status }: { stopwatch: ReturnType<typeof useStopwatch>; status: TimerStatus }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={stopwatch.toggle}
        aria-label={`${stopwatch.running ? 'עצור' : 'הפעל'} טיימר · ${STATUS_LABELS[status]}`}
        title={`${STATUS_LABELS[status]} (T)`}
        className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3 font-mono text-[17px] tabular-nums transition-colors md:text-lg ${STATUS_STYLES[status]}`}
      >
        <span dir="ltr" className="inline-flex items-center gap-1.5">
          {stopwatch.running ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          {formatClock(stopwatch.elapsedMs / 1000)}
        </span>
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={stopwatch.reset}
        disabled={!stopwatch.started}
        aria-label="אפס טיימר"
        title="איפוס"
        className="grid h-10 w-9 place-items-center rounded-lg text-ink-soft hover:bg-ink/5 disabled:opacity-35"
      >
        <RotateCcw size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

function PlanLabel({ window }: { window: SlideWindow | undefined }) {
  if (!window) return null
  return (
    <span className="hidden shrink-0 text-sm text-ink-soft sm:block" title={window.manual ? 'זמן שנקבע ידנית' : 'לפי אורך התסריט'}>
      תכנון{' '}
      <span dir="ltr" className="font-mono">
        {formatClock(window.start)}–{formatClock(window.end)}
      </span>
    </span>
  )
}

function FullscreenButton() {
  const [fullscreen, setFullscreen] = useState(() => document.fullscreenElement !== null)
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  if (!document.fullscreenEnabled) return null
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => void (fullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
      aria-label={fullscreen ? 'יציאה ממסך מלא' : 'מסך מלא'}
      title={fullscreen ? 'יציאה ממסך מלא' : 'מסך מלא'}
      className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-ink/5 md:grid"
    >
      {fullscreen ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
    </button>
  )
}

function NextSlide({ next, imageUrl }: { next: LectureDeck['slides'][number] | undefined; imageUrl: string | null | undefined }) {
  return (
    <div
      dir="ltr"
      className="hidden shrink-0 items-center gap-3 rounded-2xl border border-rule bg-card p-2.5 landscape:flex [@media(max-height:560px)]:hidden"
    >
      {next ? (
        <>
          <SlideFrame imageUrl={imageUrl} title={next.title} className="w-28 shrink-0 lg:w-40" />
          <div className="min-w-0">
            <p className={kickerStyles} lang="en">
              Next · {next.position}
            </p>
            <En as="p" className="mt-0.5 line-clamp-2 font-medium">
              {next.title || 'Untitled slide'}
            </En>
          </div>
        </>
      ) : (
        <p className="px-2 py-3 text-sm text-ink-soft" dir="rtl">
          זה השקף האחרון.
        </p>
      )}
    </div>
  )
}

type ControlButtonProps = {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  active?: boolean
  title?: string
}

/** Footer control: icon-only on phones, with a label from md. Mouse clicks do not take focus, so
 *  Space keeps meaning "next slide". */
function ControlButton({ icon, label, onClick, disabled, primary, active, title }: ControlButtonProps) {
  const tone = primary
    ? 'bg-accent text-on-accent hover:brightness-110'
    : active
      ? 'bg-accent-soft text-accent'
      : 'border border-rule bg-card text-ink hover:border-ink-faint'
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      className={`inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition disabled:opacity-35 md:px-3 ${tone}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}

function MemoControl({
  level,
  hasKeywords,
  onChange,
}: {
  level: MemoLevel
  hasKeywords: boolean
  onChange: (level: MemoLevel) => void
}) {
  return (
    <div role="group" aria-label="רמת שינון" dir="ltr" className="flex rounded-lg border border-rule bg-paper p-0.5">
      {MEMO_LEVELS.map((l) => (
        <button
          key={l}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(l)}
          aria-pressed={level === l}
          disabled={l === 3 && !hasKeywords}
          title={l === 3 && !hasKeywords ? 'מילות מפתח יגיעו ב-Sprint 2' : MEMO_TITLES[l]}
          className="h-9 min-w-8 rounded-md px-1.5 font-mono text-sm text-ink-soft transition hover:text-ink disabled:opacity-35 aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-accent aria-pressed:shadow-sm md:min-w-9"
        >
          L{l}
        </button>
      ))}
    </div>
  )
}

const MEMO_TITLES: Record<MemoLevel, string> = {
  0: 'טקסט מלא',
  1: 'כל מילה שלישית מוסתרת',
  2: 'אותיות ראשונות בלבד',
  3: 'מילות מפתח בלבד',
  4: 'בלי תסריט',
}

const HINTS: [string, string][] = [
  ['→', 'הבא'],
  ['←', 'הקודם'],
  ['T', 'טיימר'],
  ['M', 'שינון'],
  ['P', 'הצצה'],
  ['E', 'עריכה'],
  ['Esc', 'סיום עריכה'],
]

function KeyHints() {
  return (
    <p className="mt-1.5 hidden flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint lg:flex">
      {HINTS.map(([key, label]) => (
        <span key={key} className="inline-flex items-center gap-1">
          <kbd dir="ltr" className="rounded border border-rule bg-paper px-1.5 py-px font-mono text-[11px] text-ink-soft">
            {key}
          </kbd>
          {label}
        </span>
      ))}
      <span>· קליקר ו-PgDn/PgUp עובדים גם הם</span>
    </p>
  )
}

function TakeButton({
  take,
  quota,
  usage,
  onToggle,
}: {
  take: Take
  quota: ReturnType<typeof quotaState>
  usage: { minutes: number; cap: number } | undefined
  onToggle: () => void
}) {
  const usageText = usage ? `נוצלו ${Math.round(usage.minutes)} מתוך ${usage.cap} דקות Azure החודש` : ''
  if (take.phase === 'recording' || take.phase === 'stopping') {
    return (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggle}
        disabled={take.phase === 'stopping'}
        aria-label="עצור הקלטה (R)"
        title="עצור הקלטה (R או Esc)"
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-live px-3 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
      >
        <span className="relative grid h-4 w-4 place-items-center" aria-hidden="true">
          <span
            className="absolute inset-0 rounded-full bg-white/40 transition-transform"
            style={{ transform: `scale(${1 + Math.min(1, take.level * 6)})` }}
          />
          <Square size={11} fill="currentColor" />
        </span>
        <span className="hidden sm:inline">עצור</span>
      </button>
    )
  }
  const blocked = quota === 'blocked'
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
      disabled={blocked || take.phase === 'starting' || take.finished !== null}
      aria-label="הקלט חזרה (R)"
      title={blocked ? `נוצלה כמעט כל מכסת Azure החודשית. ${usageText}` : `הקלט חזרה מלאה (R). ${usageText}`}
      className={`${buttonStyles.secondary} h-10 shrink-0 px-3 text-sm ${quota === 'warn' ? 'border-warn text-warn' : ''}`}
    >
      {take.phase === 'starting' ? (
        <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
      ) : (
        <CircleDot size={16} className="text-live" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">הקלט חזרה</span>
    </button>
  )
}
