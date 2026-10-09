import type { ReactNode } from 'react'

/** A run of English words: letters, with spaces, hyphens or apostrophes between the words. */
const LATIN_RUN = /[A-Za-z][A-Za-z0-9'’]*(?:[ -][A-Za-z0-9'’]+)*/g

/** Hebrew text with English words in it: each English run is wrapped as dir="ltr" lang="en". */
export function MixedText({ text }: { text: string }): ReactNode {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(LATIN_RUN)) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(
      <span key={match.index} dir="ltr" lang="en">
        {match[0]}
      </span>,
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
