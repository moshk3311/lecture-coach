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

tips: coach tips from the speaker's own notebook, at most 5 (the facts list the CATALOG and the RULE TIPS):
- The RULE TIPS were chosen by rules from the measured times and the earlier takes. Return each one, with its own slug and trigger, tied to the moment in the recording where it applies: slide, approx_start_sec, said_en (the exact words said then) and personal_he (one Hebrew sentence that ties the tip to that moment).
- Beyond them, add up to 2 tips for what only listening reveals: low_energy, flat_emotion, no_hook (no hook in the first minute), no_key_point (the key message is unclear), no_story (no story or example with a person), weak_ending (the ending trails off).
- You may also report what you hear of: pace_fast, pace_slow, few_pauses, long_pauses, fillers, monotone, and_heavy (many "and", few "but"), low_you (little direct address). Report one only when it clearly shows in the recording.
- Take the slug from the CATALOG: a tip whose triggers include yours. Never invent a slug. When no catalog tip fits, set slug to null and write title_he, body_he and example_en (an original English line) yourself. Never present your own advice as coming from the notebook.
- Without the recording, return only the RULE TIPS, with said_en null and approx_start_sec null.
- When nothing stands out, add no extra tip. Never invent.

${HEBREW_SPEAKER_PATTERNS}`

export type SlideFacts = {
  position: number
  title: string
  seconds: number
  plannedSeconds: number
  status: string
}

/** A catalog tip as the prompt lists it: enough to choose by. */
export type CatalogEntry = { slug: string; title_he: string; triggers: string[] }

/** A tip the rules chose for the take (metrics.tips), with the measurement behind it. */
export type RuleTip = { slug: string; trigger: string | null; evidence_he: string | null }

/** What the prompt says about one take; built from the attempt and its lecture (report.ts). */
export type RunReportInput = {
  title: string
  audience: string | null
  targetSeconds: number | null
  durationSec: number
  withAudio: boolean
  visits: { position: number; start: number; end: number }[]
  slides: SlideFacts[]
  script: string
  catalog: CatalogEntry[]
  ruleTips: RuleTip[]
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
    ...tipLines(input.catalog, input.ruleTips),
    '',
    'Script, what the speaker planned to say (for context only):',
    input.script || '(no script)',
  ]
  return lines.join('\n')
}

function tipLines(catalog: CatalogEntry[], ruleTips: RuleTip[]): string[] {
  return [
    'CATALOG (slug · triggers · title):',
    ...(catalog.length ? catalog.map((tip) => `- ${tip.slug} · ${tip.triggers.join(', ') || 'no trigger'} · ${tip.title_he}`) : ['(empty: use slug null for every tip)']),
    '',
    'RULE TIPS (chosen from the measurements; slug · trigger · measurement):',
    ...(ruleTips.length ? ruleTips.map((tip) => `- ${tip.slug} · ${tip.trigger ?? 'none'} · ${tip.evidence_he ?? 'no measurement'}`) : ['(none)']),
  ]
}
