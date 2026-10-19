// Word-by-word differences between two versions of a script, for the "Americanize" proposal
// (ARCHITECTURE §5.1). Line breaks are tokens too, so paragraphs survive. Plain LCS: a slide's
// script is a few hundred words, so the quadratic table stays small.

export type DiffPart = { kind: 'same' | 'added' | 'removed'; text: string }

/** Words with their trailing punctuation, and '\n' for each paragraph break. */
function tokens(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/\s+/).filter(Boolean))
    .filter((words) => words.length > 0)
    .flatMap((words, i) => (i === 0 ? words : ['\n', ...words]))
}

/**
 * The parts that turn `before` into `after`, in order: kept, removed and added runs of words.
 * Neighbouring words of one kind are joined with a space ('\n' stays its own token).
 */
export function wordDiff(before: string, after: string): DiffPart[] {
  const a = tokens(before)
  const b = tokens(after)
  // lcs[i][j]: length of the longest common run of a[i..] and b[j..].
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }

  const parts: DiffPart[] = []
  const push = (kind: DiffPart['kind'], token: string) => {
    const last = parts.at(-1)
    if (last && last.kind === kind && token !== '\n' && last.text !== '\n') last.text += ` ${token}`
    else parts.push({ kind, text: token })
  }
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      push('same', a[i]!)
      i++
      j++
    } else if (i < a.length && (j === b.length || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
      // Removed words come before the words that replace them.
      push('removed', a[i++]!)
    } else {
      push('added', b[j++]!)
    }
  }
  return parts
}
