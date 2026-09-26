// Slide images from a PDF export of the deck, rendered in the browser with PDF.js
// (ARCHITECTURE §5.7, fallback for the LibreOffice converter).
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { supabase } from '../../lib/supabase'
import { slideImagePath, slideImagesFolder } from '../../lib/storagePaths'
import type { LectureDeck } from './api'

/** Sharp on a laptop's presenter view, small enough for the free storage tier. */
const RENDER_WIDTH = 1600

export type RenderProgress = { done: number; total: number }
export type RenderResult = { pages: number; slides: number; rendered: number }

/** A render failure with a Hebrew message the UI can show as-is. */
export class SlideImagesError extends Error {
  override name = 'SlideImagesError'
}

/**
 * Renders page n of the PDF as slide n, uploads it and points the slide at it. Slides past the
 * last page lose their image, and files from earlier renders are removed.
 */
export async function renderSlideImages(
  lecture: LectureDeck,
  pdf: File,
  onProgress: (progress: RenderProgress) => void,
): Promise<RenderResult> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { default: workerSrc } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

  const task = pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) })
  let doc: PDFDocumentProxy
  try {
    doc = await task.promise
  } catch {
    await task.destroy()
    throw new SlideImagesError('הקובץ לא נראה כמו PDF תקין.')
  }

  try {
    const slides = [...lecture.slides].sort((a, b) => a.position - b.position)
    const total = Math.min(doc.numPages, slides.length)
    const version = Date.now().toString(36)
    const written = new Set<string>()

    for (let i = 0; i < total; i++) {
      onProgress({ done: i, total })
      const slide = slides[i]!
      const blob = await renderPage(doc, i + 1)
      const ext = blob.type === 'image/webp' ? 'webp' : 'png'
      const path = slideImagePath(lecture.user_id, lecture.id, slide.position, version, ext)
      const upload = await supabase.storage.from('slides').upload(path, blob, { contentType: blob.type, upsert: true })
      if (upload.error) throw new SlideImagesError('העלאת תמונות השקפים נכשלה. בדוק את החיבור ונסה שוב.')
      const { error } = await supabase.from('slides').update({ image_path: path }).eq('id', slide.id)
      if (error) throw error
      written.add(path)
    }

    for (const slide of slides.slice(total)) {
      if (!slide.image_path) continue
      const { error } = await supabase.from('slides').update({ image_path: null }).eq('id', slide.id)
      if (error) throw error
    }
    await removeOtherImages(lecture, written)
    onProgress({ done: total, total })
    return { pages: doc.numPages, slides: slides.length, rendered: total }
  } finally {
    await task.destroy()
  }
}

async function renderPage(doc: PDFDocumentProxy, pageNumber: number): Promise<Blob> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: RENDER_WIDTH / page.getViewport({ scale: 1 }).width })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  try {
    await page.render({ canvas, viewport }).promise
    // WebP where the browser can encode it (Chrome, Firefox); Safari falls back to PNG.
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new SlideImagesError('לא הצלחתי לצייר את השקף.'))), 'image/webp', 0.9),
    )
  } finally {
    page.cleanup()
    // Frees the canvas memory right away (iOS keeps a tight canvas budget).
    canvas.width = 0
    canvas.height = 0
  }
}

/** Best effort: leftovers only cost storage, so a failure here does not fail the render. */
async function removeOtherImages(lecture: LectureDeck, keep: Set<string>): Promise<void> {
  const folder = slideImagesFolder(lecture.user_id, lecture.id)
  const { data } = await supabase.storage.from('slides').list(folder, { limit: 1000 })
  const stale = (data ?? []).map((file) => `${folder}/${file.name}`).filter((path) => !keep.has(path))
  if (stale.length) await supabase.storage.from('slides').remove(stale)
}
