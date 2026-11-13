/** Files picked or dropped together, sorted by extension: the deck, its PDF export, and the rest. */
export type DeckFiles = {
  pptx?: File
  pdf?: File
  /** Files that are neither .pptx nor .pdf. */
  rejected: File[]
  /** More than one .pptx was given (the first one is kept). */
  extraPptx: boolean
}

export function splitDeckFiles(files: Iterable<File>): DeckFiles {
  const result: DeckFiles = { rejected: [], extraPptx: false }
  for (const file of files) {
    if (/\.pptx$/i.test(file.name)) {
      if (result.pptx) result.extraPptx = true
      else result.pptx = file
    } else if (/\.pdf$/i.test(file.name)) {
      result.pdf ??= file
    } else {
      result.rejected.push(file)
    }
  }
  return result
}
