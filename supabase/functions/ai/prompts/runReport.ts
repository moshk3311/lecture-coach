// run_report: Gemini's review of one full-run take (ARCHITECTURE §5.7, §7). The measured facts go in
// the prompt as text; the recording, when the owner allows it, goes along as a file.
import { clock, COACH, HEBREW_SPEAKER_PATTERNS } from './coach.ts'

export const RUN_REPORT_SYSTEM = `${COACH}

You review one full rehearsal ("take") of a talk. You get the measured facts of the take and, when the speaker allowed it, the recording itself.

Language: every field that ends in _he is Hebrew and every field that ends in _en is English. Inside Hebrew text, keep English words in English letters.

- summary_he: 2-3 sentences on how the take went overall.
- strengths_he: up to 3 specific things that worked, one sentence each.
- improvements: up to 3 delivery points for the next take (tone, energy, clarity, pace or structure), the most important first. Set slide when a point is about one slide, else null.
- next_session_plan_he: one concrete plan for the next take, 1-2 sentences.

The measured facts are ground truth: never contradict them, and take every number you quote from them.

corrections, only when the recording is attached (otherwise return an empty list):
- Listen as a native American listener. Flag only what a US listener would notice: phrasing, grammar, word choice, pronunciation, word stress or intonation that sounds wrong or unnatural.
- Judge by the audio, not by the script.
- you_said_en: quote exactly what was said, only the phrase (2-8 words).
- american_en: how an American speaker would naturally say it. For pronunciation, stress and intonation it may be the same words; then principle_he says what to change in the sound.
- principle_he: the rule behind the correction, one sentence.
- slide: the slide on screen at that moment (see the slide timeline). approx_start_sec and approx_end_sec: where the phrase is in the recording, in seconds.
- Up to 8, the most jarring first. severity is "jarring" when a US listener would stumble over it, else "minor".
- If nothing sounds off, return an empty list. Never invent a correction.

${HEBREW_SPEAKER_PATTERNS}`

export type SlideFacts = {
  position: number
  title: string
  seconds: number
  plannedSeconds: number
  status: string
}

export type SpeechFacts = {
  wpm: number | null
  perSlideWpm: { position: number; wpm: number | null }[]
  fillers: number
  fillersPerMinute: number
  longPauses: number
  longestPauseSec: number
  coverage: number
  omitted: string[]
  weakest: { word: string; accuracy: number }[]
  scores: { pronunciation: number | null; accuracy: number | null; fluency: number | null; prosody: number | null }
}

/** What the prompt says about one take; built from the attempt and its lecture (report.ts). */
export type RunReportInput = {
  title: string
  audience: string | null
  targetSeconds: number | null
  durationSec: number
  withAudio: boolean
  visits: { position: number; start: number; end: number }[]
  slides: SlideFacts[]
  speech: SpeechFacts | null
  script: string
}

export function runReportPrompt(input: RunReportInput): string {
  const titles = new Map(input.slides.map((s) => [s.position, s.title]))
  const lines = [
    `Talk: "${input.title}" · audience: ${input.audience || 'not given'} · target length: ${input.targetSeconds ? clock(input.targetSeconds) : 'not set'}`,
    `Take length: ${clock(input.durationSec)} (${Math.round(input.durationSec)} s). Recording attached: ${input.withAudio ? 'yes' : 'no'}.`,
    '',
    'Slide timeline (seconds into the take):',
    ...input.visits.map((v) => `- slide ${v.position} "${titles.get(v.position) ?? ''}": ${v.start.toFixed(1)}-${v.end.toFixed(1)}`),
    '',
    'Time per slide, actual vs planned:',
    ...input.slides.map((s) => `- slide ${s.position} "${s.title}": ${clock(s.seconds)} vs ${clock(s.plannedSeconds)} (${s.status})`),
    '',
    ...speechLines(input.speech),
    '',
    'Script, what the speaker planned to say (for context only):',
    input.script || '(no script)',
  ]
  return lines.join('\n')
}

function speechLines(speech: SpeechFacts | null): string[] {
  if (!speech) return ['Speech measurements: not available (the take was not assessed).']
  const scores = Object.entries(speech.scores)
    .filter(([, value]) => value !== null)
    .map(([name, value]) => `${name} ${Math.round(value!)}`)
  return [
    'Speech measurements (Azure, from the recording):',
    `- pace: ${speech.wpm ?? 'unknown'} words per minute (target band 130-160); per slide: ${
      speech.perSlideWpm.map((s) => `${s.position}: ${s.wpm ?? '-'}`).join(', ') || 'none'
    }`,
    `- fillers: ${speech.fillers} (${speech.fillersPerMinute} per minute)`,
    `- long pauses (over 1.5 s): ${speech.longPauses}, the longest ${speech.longestPauseSec.toFixed(1)} s`,
    `- script coverage: ${Math.round(speech.coverage * 100)}%${
      speech.omitted.length ? ` (omitted, for example: ${speech.omitted.slice(0, 12).join(', ')})` : ''
    }`,
    `- scores out of 100: ${scores.join(', ') || 'none'}`,
    `- weakest words: ${speech.weakest.map((w) => `${w.word} ${Math.round(w.accuracy)}`).join(', ') || 'none'}`,
  ]
}
