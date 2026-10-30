// A slide's script is stored as sentences (the practice units, ARCHITECTURE §5.1). These pure
// helpers turn script text into sentences and back, and decide which sentence ids survive an edit.

export type ScriptSentence = { text: string; starts_paragraph: boolean }
export type StoredSentence = ScriptSentence & { id: string }
/** A sentence to save: `id` is kept from the stored sentence it replaces, or null for a new one. */
export type SentenceDraft = ScriptSentence & { id: string | null }

// Abbreviations that are followed by more of the same sentence ("Dr. Levi", "vs. last year").
const NO_BREAK_AFTER = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'approx', 'fig', 'cf', 'ca', 'dept', 'est', 'vol'])
const BULLET = /^[•▪◦‣∙·*\-–—]\s+/u
const TERMINATOR = /[.!?…]+["'”’)\]]*(?=\s|$)/gu

/**
 * Splits script text into sentences. Every line is a paragraph; bullet glyphs are dropped.
 * Deterministic on every browser (no Intl.Segmenter), so ids stay stable across devices.
 */
export function splitScript(text: string): ScriptSentence[] {
  const out: ScriptSentence[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim().replace(BULLET, '')
    if (!line) continue
    splitLine(line).forEach((sentence, i) => out.push({ text: sentence, starts_paragraph: i === 0 }))
  }
  return out
}

function splitLine(line: string): string[] {
  const sentences: string[] = []
  let start = 0
  for (const match of line.matchAll(TERMINATOR)) {
    const end = match.index + match[0].length
    if (end >= line.length) break
    if (!isBoundary(line, match.index, match[0], end)) continue
    sentences.push(line.slice(start, end).trim())
    start = end
  }
  const rest = line.slice(start).trim()
  if (rest) sentences.push(rest)
  return sentences
}

function isBoundary(line: string, index: number, terminator: string, end: number): boolean {
  const next = line.slice(end).trimStart()
  const nextChar = next.replace(/^["'“‘([]+/u, '').charAt(0)
  if (!nextChar || /\p{Ll}/u.test(nextChar)) return false
  if (!terminator.includes('.') || /[!?…]/u.test(terminator)) return true
  if (/\d/.test(nextChar)) return false
  const word = /(\S+)$/.exec(line.slice(0, index))?.[1]?.replace(/^["'“‘([]+/u, '') ?? ''
  if (terminator.startsWith('...')) return true
  // Initials ("J. Smith"), dotted abbreviations ("e.g.", "U.S.") and known short forms.
  if (/^\p{L}$/u.test(word) || word.includes('.')) return false
  return !NO_BREAK_AFTER.has(word.toLowerCase())
}

/** Script text for editing and display: paragraphs on their own lines, sentences joined by a space. */
export function joinScript(sentences: ScriptSentence[]): string {
  return sentences.map((s, i) => (i === 0 ? s.text : `${s.starts_paragraph ? '\n' : ' '}${s.text}`)).join('')
}

/**
 * Splits edited script text like splitScript, but keeps the owner's own segmentation: a run of stored
 * sentences that is still in a line word for word, starting and ending where splitScript would cut,
 * stays as those sentences. So a merge or a split made in the sentence editor survives later edits.
 */
export function resegment(stored: ScriptSentence[], text: string): ScriptSentence[] {
  const known = stored.map((s) => normalize(s.text)).filter(Boolean)
  const out: ScriptSentence[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const units = splitScript(rawLine).map((s) => s.text)
    if (!units.length) continue
    const line = units.join(' ')
    const starts: number[] = []
    const endUnit = new Map<number, number>()
    let at = 0
    units.forEach((unit, i) => {
      starts.push(at)
      at += unit.length
      endUnit.set(at, i)
      at += 1
    })

    const pieces: string[] = []
    for (let u = 0; u < units.length; ) {
      const run = storedRun(known, line, starts[u]!, endUnit)
      if (run) {
        pieces.push(...run.texts)
        u = run.lastUnit + 1
      } else {
        pieces.push(units[u]!)
        u += 1
      }
    }
    pieces.forEach((piece, i) => out.push({ text: piece, starts_paragraph: i === 0 }))
  }
  return out
}

/** The longest run of consecutive stored sentences found at `start` that ends where a unit ends. */
function storedRun(known: string[], line: string, start: number, endUnit: Map<number, number>) {
  let best: { texts: string[]; lastUnit: number; end: number } | null = null
  known.forEach((first, i) => {
    if (!line.startsWith(first, start)) return
    let end = start + first.length
    for (let k = i; ; ) {
      const lastUnit = endUnit.get(end)
      if (lastUnit !== undefined && (!best || end > best.end)) best = { texts: known.slice(i, k + 1), lastUnit, end }
      const next = known[++k]
      if (next === undefined || line[end] !== ' ' || !line.startsWith(next, end + 1)) break
      end += 1 + next.length
    }
  })
  return best as { texts: string[]; lastUnit: number; end: number } | null
}

export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’]\p{L}+)*/gu)?.length ?? 0
}

/**
 * Pairs the edited script with the stored sentences: unchanged sentences keep their ids (so cached
 * reference audio survives), and a sentence edited in place keeps its id when it is still similar.
 */
export function planScriptSave(stored: StoredSentence[], next: ScriptSentence[]): SentenceDraft[] {
  const a = stored.map((s) => normalize(s.text))
  const b = next.map((s) => normalize(s.text))
  const ids: (string | null)[] = next.map(() => null)

  // Longest common subsequence of identical sentences.
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }

  // Walk the alignment; between matches, pair removed and added sentences in order when similar.
  let i = 0
  let j = 0
  let removed: number[] = []
  let added: number[] = []
  const flush = () => {
    for (let k = 0; k < Math.min(removed.length, added.length); k++) {
      const [from, to] = [removed[k]!, added[k]!]
      if (similarity(a[from]!, b[to]!) >= 0.5) ids[to] = stored[from]!.id
    }
    removed = []
    added = []
  }
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush()
      ids[j] = stored[i]!.id
      i++
      j++
    } else if (j < b.length && (i >= a.length || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
      added.push(j++)
    } else {
      removed.push(i++)
    }
  }
  flush()

  return next.map((s, k) => ({ ...s, id: ids[k] ?? null }))
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Dice coefficient over lowercase words. */
function similarity(x: string, y: string): number {
  const words = (t: string) => t.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []
  const wx = words(x)
  const wy = words(y)
  if (!wx.length || !wy.length) return 0
  const counts = new Map<string, number>()
  for (const w of wx) counts.set(w, (counts.get(w) ?? 0) + 1)
  let common = 0
  for (const w of wy) {
    const n = counts.get(w) ?? 0
    if (n > 0) {
      common++
      counts.set(w, n - 1)
    }
  }
  return (2 * common) / (wx.length + wy.length)
}

// Sentence editor (§5.1): the owner's own segmentation of a slide. A sentence keeps its id when it is
// split (the first part) or merged (the first sentence); save_slide_script clears its audio when the
// text changed.

/** A sentence longer than this is hard to practice in one take (the Americanize rule, §8). */
export const LONG_SENTENCE_WORDS = 20

/** Splits the sentence at `index` before its word `word` (1 … words − 1). */
export function splitSentence(list: SentenceDraft[], index: number, word: number): SentenceDraft[] {
  const sentence = list[index]
  const words = sentence ? normalize(sentence.text).split(' ') : []
  if (!sentence || word < 1 || word >= words.length) return list
  return [
    ...list.slice(0, index),
    { ...sentence, text: words.slice(0, word).join(' ') },
    { id: null, text: words.slice(word).join(' '), starts_paragraph: false },
    ...list.slice(index + 1),
  ]
}

/** Merges the sentence at `index` with the one after it. */
export function mergeWithNext(list: SentenceDraft[], index: number): SentenceDraft[] {
  const [a, b] = [list[index], list[index + 1]]
  if (!a || !b) return list
  return [...list.slice(0, index), { ...a, text: `${normalize(a.text)} ${normalize(b.text)}` }, ...list.slice(index + 2)]
}

/** Moves the sentence at `index` one place up (−1) or down (+1); the first sentence always opens a paragraph. */
export function moveSentence(list: SentenceDraft[], index: number, delta: -1 | 1): SentenceDraft[] {
  const to = index + delta
  if (!list[index] || !list[to]) return list
  const next = [...list]
  ;[next[index], next[to]] = [next[to]!, next[index]!]
  return next.map((s, i) => (i === 0 && !s.starts_paragraph ? { ...s, starts_paragraph: true } : s))
}

/** Starts a new paragraph at the sentence, or joins it to the paragraph before (not the first sentence). */
export function toggleParagraph(list: SentenceDraft[], index: number): SentenceDraft[] {
  if (index < 1 || !list[index]) return list
  return list.map((s, i) => (i === index ? { ...s, starts_paragraph: !s.starts_paragraph } : s))
}
