import { En } from '../../components/En'
import { scoreBand, type ScoreBand } from '../../lib/scoreBands'

// A sample result on a dark "stage": what the app gives you after every take.
// Colors are fixed (the stage is always dark), matching the dark-theme score bands.

const WORDS: { text: string; score: number }[] = [
  { text: 'Today', score: 94 },
  { text: "I'd", score: 89 },
  { text: 'like', score: 92 },
  { text: 'to', score: 95 },
  { text: 'walk', score: 71 },
  { text: 'you', score: 90 },
  { text: 'through', score: 54 },
  { text: 'our', score: 87 },
  { text: 'architecture.', score: 76 },
]

const SCORES: { name: string; value: number }[] = [
  { name: 'Pron', value: 82 },
  { name: 'Accuracy', value: 79 },
  { name: 'Fluency', value: 90 },
  { name: 'Prosody', value: 77 },
]

const UNDERLINE: Record<ScoreBand, string> = {
  good: 'decoration-[#6fcf97]',
  warn: 'decoration-[#e6b35a]',
  bad: 'decoration-[#f08a7e]',
}

const TEXT: Record<ScoreBand, string> = {
  good: 'text-[#6fcf97]',
  warn: 'text-[#e6b35a]',
  bad: 'text-[#f08a7e]',
}

export function StagePreview() {
  return (
    <section
      aria-label="דוגמה לתוצאה"
      className="relative flex flex-col justify-center overflow-hidden bg-[#1a1916] px-6 py-12 text-[#f3efe6] sm:px-12 lg:min-h-dvh"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_65%_at_35%_0%,rgba(255,236,200,0.17),transparent_62%)]"
      />
      <div className="relative mx-auto w-full max-w-xl">
        <En as="p" className="flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] text-[#b9b3a5] uppercase">
          <span className="h-2 w-2 animate-pulse-live rounded-full bg-[#ff6a57]" aria-hidden="true" />
          Rec · Take 3 · 00:04
        </En>

        <En as="p" className="mt-7 text-[26px] leading-[1.75] font-medium sm:text-[32px]">
          {WORDS.map((word, i) => (
            <span key={word.text}>
              <span
                className={`underline decoration-[3px] underline-offset-[10px] ${UNDERLINE[scoreBand(word.score)]} ${
                  word.score < 60 ? 'rounded-md bg-[#f08a7e]/15 px-1' : ''
                }`}
              >
                {word.text}
              </span>
              {i < WORDS.length - 1 ? ' ' : null}
            </span>
          ))}
        </En>

        <div className="mt-9 rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <En as="p" className="font-mono text-sm text-[#d8d2c4]">
            <span className="text-[#f08a7e]">through</span> /θruː/ · heard /truː/
          </En>
          <p className="mt-2 text-[15px] leading-relaxed text-[#d8d2c4]">
            הצליל θ יצא t. שים את קצה הלשון בין השיניים ונשוף אוויר.
          </p>
        </div>

        <En as="dl" className="mt-6 grid grid-cols-4 gap-2 text-center">
          {SCORES.map(({ name, value }) => (
            <div key={name} className="rounded-lg border border-white/10 px-1 py-2.5">
              <dt className="font-mono text-[10px] tracking-wider text-[#9d978a] uppercase">{name}</dt>
              <dd className={`mt-1 font-mono text-xl ${TEXT[scoreBand(value)]}`}>{value}</dd>
            </div>
          ))}
        </En>

        <p className="mt-6 text-sm text-[#9d978a]">דוגמה: ציון לכל מילה וצליל, והסבר בעברית.</p>
      </div>
    </section>
  )
}
