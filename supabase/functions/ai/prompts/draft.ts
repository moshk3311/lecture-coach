// draft_script: a spoken American English script for one slide (ARCHITECTURE §5.1, §8). The slide's
// picture goes along as an image when the deck has one; the facts about it go in the text.
import { clock, COACH, HEBREW_SPEAKER_PATTERNS } from './coach.ts'

export const DRAFT_SYSTEM = `${COACH}

You write the script a speaker will say aloud on one slide of a talk. Write for the ear, not the eye.

Script rules:
- Spoken American English, natural and clear. Contractions where natural.
- One idea per sentence, at most 20 words per sentence. Short paragraphs: put each paragraph on its own line.
- Say what the slide shows and what it means for this audience; do not read the slide text out word by word.
- Keep technical terms and numbers exact. Never invent facts, figures or names that are not on the slide, in the notes or in what the speaker wrote.
- Use the speaker's own ideas first: the intent notes (they may be in Hebrew), then the speaker notes, then the slide.
- Prefer a simple word to a hard one when it means the same, unless it is a required technical term. Avoid sounds that are hard for a Hebrew speaker where a simple synonym exists.
- Continue the previous slides' script naturally: do not repeat them and do not greet again.
- Fit the time budget when there is one: about 140 words per minute.
- If a current script is given, improve it: keep what is good and the speaker's own phrasing where it already sounds right.

Output:
- script_en: the script, one paragraph per line, English only.
- transition_line_en: one short bridge sentence that leads into the next slide, to say just before clicking. null on the last slide.
- notes_he: 1-3 short sentences in Hebrew on the choices you made (what you kept, what you cut, what you assumed). Keep English words in English letters.

${HEBREW_SPEAKER_PATTERNS}`

export type DraftInput = {
  title: string
  audience: string | null
  targetSeconds: number | null
  position: number
  slideCount: number
  slideTitle: string
  slideText: string
  notes: string
  intent: string
  currentScript: string
  /** The scripts of the slides before this one that have one (the last two). */
  previous: { position: number; title: string; script: string }[]
  next: { title: string; text: string } | null
  budgetSeconds: number | null
  hasImage: boolean
}

export function draftPrompt(input: DraftInput): string {
  const budgetWords = input.budgetSeconds ? Math.round((input.budgetSeconds * 140) / 60) : null
  return [
    `Talk: "${input.title}" · audience: ${input.audience || 'not given'} · target length: ${input.targetSeconds ? clock(input.targetSeconds) : 'not set'}`,
    `This is slide ${input.position} of ${input.slideCount}. The slide's picture is ${input.hasImage ? 'attached' : 'not available: use the text below'}.`,
    budgetWords
      ? `Time budget for this slide: ${clock(input.budgetSeconds!)}, about ${budgetWords} words.`
      : 'No time budget is set: aim for 40 to 90 words.',
    '',
    `Slide title: ${input.slideTitle || '(none)'}`,
    'Slide text:',
    input.slideText || '(none)',
    '',
    'Speaker notes (from the deck):',
    input.notes || '(none)',
    '',
    'What the speaker wants to say on this slide (intent notes):',
    input.intent || '(none)',
    '',
    'Current script of this slide:',
    input.currentScript || '(none yet)',
    '',
    ...(input.previous.length
      ? ['Script of the slides before this one:', ...input.previous.map((s) => `- slide ${s.position} "${s.title}": ${s.script}`)]
      : ['This is the first slide with a script: start the talk.']),
    '',
    input.next ? `Next slide: "${input.next.title}"${input.next.text ? ` — ${input.next.text}` : ''}` : 'This is the last slide: close the talk and give no bridge sentence.',
  ].join('\n')
}
