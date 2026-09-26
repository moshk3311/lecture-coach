import type { ParsedDeck } from '../../lib/pptx'
import { supabase } from '../../lib/supabase'
import { pptxPath } from '../../lib/storagePaths'
import type { Lecture } from './api'
import { MAX_UPLOAD_BYTES, toImportSlides } from './importPayload'

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

/**
 * Creates the slides and their first scripts (one transaction), then keeps the PPTX in Storage.
 * The upload is best effort: the presenter view does not need it.
 */
export async function importDeck(lecture: Lecture, file: File, deck: ParsedDeck): Promise<{ pptxSaved: boolean }> {
  const { error } = await supabase.rpc('import_slides', { p_lecture_id: lecture.id, p_slides: toImportSlides(deck) })
  if (error) throw error

  if (file.size > MAX_UPLOAD_BYTES) return { pptxSaved: false }
  const path = pptxPath(lecture.user_id, lecture.id)
  const upload = await supabase.storage.from('pptx').upload(path, file, { upsert: true, contentType: PPTX_MIME })
  if (upload.error) return { pptxSaved: false }
  const update = await supabase.from('lectures').update({ pptx_path: path }).eq('id', lecture.id)
  return { pptxSaved: !update.error }
}
