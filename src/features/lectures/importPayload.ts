import type { ParsedDeck } from '../../lib/pptx'
import { splitScript, type ScriptSentence } from '../../lib/script'

/** Supabase free plan: 50 MB per upload (ARCHITECTURE Appendix B). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export type ImportSlide = {
  title: string | null
  source_text: string
  source_notes: string
  sentences: ScriptSentence[]
}

/** The import_slides payload. Each slide's first script is its speaker notes (ARCHITECTURE §11, Sprint 1). */
export function toImportSlides(deck: ParsedDeck): ImportSlide[] {
  return deck.slides.map((slide) => ({
    title: slide.title,
    source_text: slide.text,
    source_notes: slide.notes,
    sentences: splitScript(slide.notes),
  }))
}

/** A title for a new lecture: the first slide's title, else the file name. */
export function suggestTitle(fileName: string, deck: ParsedDeck): string {
  const fromSlide = deck.slides[0]?.title?.trim()
  if (fromSlide) return fromSlide
  return fileName.replace(/\.pptx$/i, '').replace(/[_]+/g, ' ').trim()
}
