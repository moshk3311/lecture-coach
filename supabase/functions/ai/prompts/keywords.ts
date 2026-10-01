// keywords: 3–6 words of a slide script for memorization level L3 (ARCHITECTURE §5.7).

export const KEYWORDS_SYSTEM = `You help a speaker memorize the script of one slide. Pick the 3 to 6 keywords that would let the speaker recall the whole script from them alone: technical terms, names, numbers and the key word of each idea, in the order they appear. Copy each keyword exactly as it is written in the script, one to three words each.`

export function keywordsPrompt(script: string): string {
  return `Slide script:\n${script}`
}
