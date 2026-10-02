import { LoaderCircle, Play } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { En } from '../../components/En'
import { PlayButton } from '../../components/PlayButton'
import { buttonStyles } from '../../components/styles'
import type { PhraseSpan } from '../../lib/anchor'
import type { Correction } from '../../providers'
import { useReferenceClip, useTakeSlice } from './aiReport'
import type { RunDetail } from './api'
import { CATEGORY_LABELS, correctionSpan, SEVERITY_LABELS } from './feedback'

/** One correction: what was said next to how an American says it, each playable (§5.7). */
export function CorrectionCard({ index, correction, run }: { index: number; correction: Correction; run: RunDetail }) {
  const span = useMemo(
    () => correctionSpan(correction, run.word_results, Number(run.duration_sec)),
    [correction, run.word_results, run.duration_sec],
  )
  const jarring = correction.severity === 'jarring'

  return (
    <li className="rounded-xl border border-rule p-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-mono text-ink-faint">{index}</span>
        <span className="font-medium">{CATEGORY_LABELS[correction.category]}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${jarring ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn'}`}>
          {SEVERITY_LABELS[correction.severity]}
        </span>
        {correction.slide ? <span className="text-ink-faint">· שקף {correction.slide}</span> : null}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Phrase label="מה אמרת" text={correction.you_said_en} tint="bg-ink/5">
          <YouButton audioPath={run.audio_path} span={span} />
        </Phrase>
        <Phrase label="איך אמריקאים אומרים" text={correction.american_en} tint="bg-good-soft">
          <AmericanButton text={correction.american_en} />
        </Phrase>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{correction.principle_he}</p>
    </li>
  )
}

function Phrase({ label, text, tint, children }: { label: string; text: string; tint: string; children: ReactNode }) {
  return (
    <div className={`rounded-lg p-3 ${tint}`}>
      <p className="text-xs text-ink-soft">{label}</p>
      <En as="p" className="mt-1 text-[17px] leading-snug font-medium">
        {text}
      </En>
      <div className="mt-2.5">{children}</div>
    </div>
  )
}

const YOU = 'הקול שלך'
const AMERICAN = 'קול אמריקאי'

/** Hidden once the take's recording is deleted (§6) or when Gemini gave no time. */
function YouButton({ audioPath, span }: { audioPath: string | null; span: PhraseSpan | null }) {
  const slice = useTakeSlice(audioPath, span)
  if (!audioPath || !span) return null
  if (slice.isError) return <Unavailable label={YOU} reason="לא הצלחתי לטעון את הקטע מההקלטה." />
  return slice.data ? <PlayButton src={slice.data} label={YOU} /> : <Loading label={YOU} />
}

/** Why the American voice is missing is said once, above the list (AmericanVoiceNote). */
function AmericanButton({ text }: { text: string }) {
  const clip = useReferenceClip(text)
  if (clip.isError) return <Unavailable label={AMERICAN} reason={errorText(clip.error)} />
  return clip.data ? <PlayButton src={clip.data} label={AMERICAN} /> : <Loading label={AMERICAN} />
}

/** One note when the American voice cannot be made (no Azure keys, quota, network). */
export function AmericanVoiceNote({ text }: { text: string }) {
  const clip = useReferenceClip(text)
  if (!clip.isError) return null
  return <p className="text-sm text-ink-faint">הקול האמריקאי לא זמין כרגע: {errorText(clip.error)}</p>
}

function Loading({ label }: { label: string }) {
  return (
    <button type="button" disabled className={`${buttonStyles.secondary} h-9 px-3 text-sm`}>
      <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
      {label}
    </button>
  )
}

function Unavailable({ label, reason }: { label: string; reason: string }) {
  return (
    <button type="button" disabled title={reason} className={`${buttonStyles.secondary} h-9 px-3 text-sm`}>
      <Play size={14} aria-hidden="true" />
      {label}
    </button>
  )
}

function errorText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'שגיאה לא ידועה.'
}
