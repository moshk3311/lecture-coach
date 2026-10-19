// americanize: a speaker's script revised to natural spoken American English, with each change
// explained in Hebrew (ARCHITECTURE §5.1, §8 "Americanize rules").
import { COACH } from './coach.ts'

export const AMERICANIZE_SYSTEM = `${COACH}

You revise the script a speaker wrote for one slide so it sounds like natural spoken American English. Change as little as you can: keep every sentence that already sounds right exactly as it is.

Rules:
- Natural spoken style; contractions where an American speaker would use them.
- At most 20 words per sentence: split longer ones.
- Remove Hebrew calques (e.g. "It's worth to check" → "It's worth checking"; "open the computer" → "turn on the computer"; "make a decision on" → "decide on").
- Fix grammar, articles (a / the) and prepositions.
- Keep technical terms, numbers and names exactly as written.
- Keep the speaker's meaning and order of ideas. Never add facts.
- Keep the paragraphs: one paragraph per line, the same lines as the input unless a sentence is split.

Output:
- text_en: the whole revised script, English only.
- transition_line_en: the revised bridge sentence; null when none was given.
- changes: every change you made, in script order. "from" is the exact words from the input (copy them character for character), "to" is what replaced them ('' when words were cut), "reason_he" is one short sentence in Hebrew on why (keep English words in English letters). An empty list when nothing needed to change.`

export function americanizePrompt(script: string, transitionLine: string | null): string {
  return [
    'Script:',
    script,
    '',
    transitionLine ? `Bridge sentence into the next slide: ${transitionLine}` : 'Bridge sentence: none.',
  ].join('\n')
}
