import { CircleAlert, CircleCheck, LoaderCircle, Play } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { parseWav } from '../../audio/wav'
import { En } from '../../components/En'
import { PlayButton } from '../../components/PlayButton'
import { buttonStyles, cardStyles } from '../../components/styles'
import { scoreBand } from '../../lib/scoreBands'
import { speech } from '../../providers'
import { utteranceScores, type UtteranceScores } from '../../speech/azureResult'
import { getAzureToken } from '../../speech/tokenClient'

// Synthesized by Azure, then scored by Azure: proves token, voice and prosody end to end
// (ARCHITECTURE §14 items 3 and 6). Costs about 5 seconds of the monthly audio quota.
const SAMPLE_TEXT = "Thank you all for coming. Today I'd like to walk you through our new architecture."

type StepId = 'token' | 'tts' | 'assess'
type StepStatus = 'idle' | 'running' | 'ok' | 'warn' | 'error'
type StepState = { status: StepStatus; detail?: ReactNode }

const STEPS: { id: StepId; label: string }[] = [
  { id: 'token', label: 'טוקן מהשרת' },
  { id: 'tts', label: 'קול אמריקאי (TTS)' },
  { id: 'assess', label: 'הערכת הגייה ו-prosody' },
]

const IDLE: Record<StepId, StepState> = { token: { status: 'idle' }, tts: { status: 'idle' }, assess: { status: 'idle' } }

function elapsed(since: number): string {
  const ms = performance.now() - since
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function AzureCheck({ voice }: { voice: string }) {
  const [steps, setSteps] = useState(IDLE)
  const [running, setRunning] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  async function run() {
    const update = (id: StepId, state: StepState) => setSteps((prev) => ({ ...prev, [id]: state }))
    let current: StepId = 'token'
    setRunning(true)
    setSteps(IDLE)
    setAudioUrl(null)

    try {
      update('token', { status: 'running' })
      const tokenStart = performance.now()
      const { region } = await getAzureToken()
      update('token', { status: 'ok', detail: <>אזור <En>{region}</En> · <En>{elapsed(tokenStart)}</En></> })

      current = 'tts'
      update('tts', { status: 'running' })
      const ttsStart = performance.now()
      const tts = await speech.synthesize({ text: SAMPLE_TEXT, voice, format: 'wav16k' })
      setAudioUrl(URL.createObjectURL(new Blob([tts.audio], { type: tts.mimeType })))
      update('tts', {
        status: 'ok',
        detail: (
          <>
            <En>{voice}</En> · {tts.wordTimings.length} גבולות מילים · <En>{elapsed(ttsStart)}</En>
          </>
        ),
      })

      current = 'assess'
      update('assess', { status: 'running' })
      const assessStart = performance.now()
      const wav = parseWav(tts.audio)
      if (wav.sampleRate !== 16000 || wav.channels !== 1 || wav.bitsPerSample !== 16) {
        throw new Error(`Unexpected TTS format: ${wav.sampleRate} Hz, ${wav.channels} ch, ${wav.bitsPerSample} bit`)
      }
      const result = await speech.assessOnce({ pcm: wav.data, referenceText: SAMPLE_TEXT })
      const scores = utteranceScores(result.raw)
      update('assess', {
        status: scores.prosody === null ? 'warn' : 'ok',
        detail: <ScoreLine scores={scores} took={elapsed(assessStart)} />,
      })
    } catch (err) {
      update(current, { status: 'error', detail: <span dir="auto">{errorText(err)}</span> })
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className={`${cardStyles} p-6 md:p-8`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-prose">
          <h2 className="font-display text-xl font-semibold">בדיקת Azure</h2>
          <p className="mt-2 leading-relaxed text-ink-soft">
            בדיקה מקצה לקצה: טוקן מהשרת, סינתזה של המשפט בקול אמריקאי והערכת הגייה של הסינתזה עם ציון
            prosody. הבדיקה צורכת כ-5 שניות מהמכסה החודשית.
          </p>
        </div>
        <button type="button" onClick={() => void run()} disabled={running} className={buttonStyles.primary}>
          {running ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          {running ? 'בודק…' : 'הרץ בדיקה'}
        </button>
      </div>

      <En as="p" className="mt-5 rounded-lg border border-rule bg-paper px-4 py-3 text-[15px] leading-relaxed">
        {SAMPLE_TEXT}
      </En>

      <ol className="mt-5 divide-y divide-rule" aria-live="polite">
        {STEPS.map(({ id, label }) => (
          <li key={id} className="flex items-start gap-3 py-3.5">
            <StatusIcon status={steps[id].status} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{label}</p>
              {steps[id].detail ? <div className="mt-1 text-sm text-ink-soft">{steps[id].detail}</div> : null}
            </div>
            {id === 'tts' && audioUrl ? <PlayButton src={audioUrl} /> : null}
          </li>
        ))}
      </ol>
    </section>
  )
}

function StatusIcon({ status }: { status: StepStatus }) {
  const common = { size: 20, 'aria-hidden': true } as const
  switch (status) {
    case 'running':
      return <LoaderCircle {...common} className="mt-0.5 shrink-0 animate-spin text-accent" />
    case 'ok':
      return <CircleCheck {...common} className="mt-0.5 shrink-0 text-good" />
    case 'warn':
      return <CircleAlert {...common} className="mt-0.5 shrink-0 text-warn" />
    case 'error':
      return <CircleAlert {...common} className="mt-0.5 shrink-0 text-bad" />
    default:
      return <span className="mt-1.5 ms-1.5 me-1.5 h-2 w-2 shrink-0 rounded-full bg-rule" aria-hidden="true" />
  }
}

const BAND_TEXT = { good: 'text-good', warn: 'text-warn', bad: 'text-bad' } as const

function ScoreLine({ scores, took }: { scores: UtteranceScores; took: string }) {
  const items: [string, number | null][] = [
    ['Pronunciation', scores.pron],
    ['Accuracy', scores.accuracy],
    ['Fluency', scores.fluency],
    ['Prosody', scores.prosody],
  ]
  return (
    <div className="space-y-1.5">
      <En as="p" className="flex flex-wrap justify-end gap-x-4 gap-y-1 font-mono text-[13px]">
        {items.map(([name, value]) => (
          <span key={name}>
            {name}{' '}
            <span className={value === null ? 'text-ink-faint' : BAND_TEXT[scoreBand(value)]}>
              {value === null ? '—' : Math.round(value)}
            </span>
          </span>
        ))}
        <span className="text-ink-faint">{took}</span>
      </En>
      {scores.prosody === null ? (
        <p className="text-warn">Azure לא החזיר ציון prosody. ייתכן שהאזור של המשאב לא תומך בזה.</p>
      ) : null}
    </div>
  )
}
