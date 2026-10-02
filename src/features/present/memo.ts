// Memorization levels (ARCHITECTURE §5.7): L0 full text · L1 every 3rd word blanked ·
// L2 first letters only · L3 keywords only · L4 no script.

export type MemoLevel = 0 | 1 | 2 | 3 | 4

export const MEMO_LEVELS: MemoLevel[] = [0, 1, 2, 3, 4]

/** A piece of the script: `shown` is what is visible, `hidden` keeps the word's shape. */
export type MemoToken = { shown: string; hidden: string }

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu

export function toMemoLevel(value: number): MemoLevel {
  return (MEMO_LEVELS as number[]).includes(value) ? (value as MemoLevel) : 0
}

/** M cycles the levels; L3 picks keywords from the script, so a slide without one skips it. */
export function nextMemoLevel(level: MemoLevel, hasScript: boolean): MemoLevel {
  const levels = MEMO_LEVELS.filter((l) => l !== 3 || hasScript)
  return levels[(levels.indexOf(level) + 1) % levels.length] ?? 0
}

/**
 * Whether stored keywords still suit the script: every word of every keyword is still in it. An
 * edit that removes one makes them stale, and L3 asks Gemini for new ones.
 */
export function keywordsFit(keywords: string[] | null | undefined, script: string): boolean {
  if (!keywords?.length) return false
  const words = new Set(script.toLowerCase().match(WORD) ?? [])
  return keywords.every((keyword) => (keyword.toLowerCase().match(WORD) ?? []).every((word) => words.has(word)))
}

/** Tokens of one paragraph at a level. L4 returns nothing; L3 keeps only keyword words. */
export function memoTokens(text: string, level: MemoLevel, keywords: string[] = []): MemoToken[] {
  if (level === 4) return []
  if (level === 0) return [{ shown: text, hidden: '' }]

  const keys = new Set(keywords.flatMap((k) => k.toLowerCase().match(WORD) ?? []))
  const tokens: MemoToken[] = []
  let last = 0
  let index = 0
  for (const match of text.matchAll(WORD)) {
    if (match.index > last) tokens.push({ shown: text.slice(last, match.index), hidden: '' })
    tokens.push(maskWord(match[0], index, level, keys))
    last = match.index + match[0].length
    index++
  }
  if (last < text.length) tokens.push({ shown: text.slice(last), hidden: '' })
  return tokens
}

function maskWord(word: string, index: number, level: MemoLevel, keys: Set<string>): MemoToken {
  switch (level) {
    case 1:
      return index % 3 === 2 ? { shown: '', hidden: word } : { shown: word, hidden: '' }
    case 2: {
      const first = Array.from(word)[0] ?? ''
      return { shown: first, hidden: word.slice(first.length) }
    }
    case 3:
      return keys.has(word.toLowerCase()) ? { shown: word, hidden: '' } : { shown: '', hidden: word }
    default:
      return { shown: word, hidden: '' }
  }
}
