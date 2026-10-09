// draft_script (ARCHITECTURE §5.1, §7): a proposed script and bridge sentence for one slide, from its
// picture, text, notes, the speaker's intent and the scripts around it. Nothing is saved here: the
// app shows the proposal and the owner accepts it.
import type { AuthedUser } from '../_shared/auth.ts'
import { userDb } from '../_shared/userDb.ts'
import { DRAFT_SCHEMA, normalizeDraft, type ScriptDraft } from './contract.ts'
import { generateJson, type GeminiConfig, type Part } from './gemini.ts'
import { isObject, list, num, text } from './json.ts'
import { PROMPT_VERSION } from './prompts/coach.ts'
import { DRAFT_SYSTEM, draftPrompt } from './prompts/draft.ts'
import { idField, RequestError, stringField } from './request.ts'

const MAX_INTENT_CHARS = 2000
/** A slide image is a few hundred kB; anything bigger is left out and the text carries the slide. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

type SlideRow = {
  id: string
  lecture_id: string
  position: number
  title: string | null
  source_text: string | null
  source_notes: string | null
  intent_notes: string | null
  image_path: string | null
  planned_seconds: number | null
  sentences: { text: string; position: number; starts_paragraph: boolean }[]
}

export async function draftScript(user: AuthedUser, payload: unknown, gemini: GeminiConfig): Promise<ScriptDraft> {
  const db = userDb(user)
  const slideId = idField(payload, 'slide_id')
  const slides = await slidesOfLecture(db, slideId)
  const slide = slides.find((s) => s.id === slideId)
  if (!slide) throw new RequestError('השקף לא נמצא.', 404)
  const lecture = await db.one<{ title: string; audience: string | null; target_minutes: number | null }>(
    `lectures?id=eq.${slide.lecture_id}&select=title,audience,target_minutes`,
  )
  const index = slides.indexOf(slide)
  const next = slides[index + 1]
  const targetSeconds = lecture?.target_minutes ? lecture.target_minutes * 60 : null
  // A slide's own planned time, else its equal share of the talk.
  const budgetSeconds = slide.planned_seconds || (targetSeconds ? Math.round(targetSeconds / slides.length) : null)
  const intent = payload && isObject(payload) && 'intent' in payload ? stringField(payload, 'intent', MAX_INTENT_CHARS) : (slide.intent_notes ?? '')

  const parts: Part[] = []
  const image = await slideImage(db, slide.image_path)
  if (image) parts.push({ inline_data: image })
  parts.push({
    text: draftPrompt({
      title: lecture?.title || 'Untitled talk',
      audience: lecture?.audience ?? null,
      targetSeconds,
      position: slide.position,
      slideCount: slides.length,
      slideTitle: slide.title ?? '',
      slideText: slide.source_text ?? '',
      notes: slide.source_notes ?? '',
      intent,
      currentScript: scriptOf(slide),
      previous: slides
        .slice(0, index)
        .filter((s) => scriptOf(s))
        .slice(-2)
        .map((s) => ({ position: s.position, title: s.title ?? '', script: scriptOf(s).replace(/\n/g, ' ').slice(0, 1500) })),
      next: next ? { title: next.title ?? '', text: (next.source_text ?? '').slice(0, 300) } : null,
      budgetSeconds,
      hasImage: image !== null,
    }),
  })

  const answer = await generateJson(gemini, { system: DRAFT_SYSTEM, parts, schema: DRAFT_SCHEMA, temperature: 0.6 })
  return normalizeDraft(answer, {
    budgetSeconds,
    sawImage: image !== null,
    isLastSlide: next === undefined,
    model: gemini.model,
    promptVersion: PROMPT_VERSION,
  })
}

/** Every slide of the lecture the slide belongs to, in order, with its sentences. */
async function slidesOfLecture(db: ReturnType<typeof userDb>, slideId: string): Promise<SlideRow[]> {
  const own = await db.one<{ lecture_id: string }>(`slides?id=eq.${slideId}&select=lecture_id`)
  if (!own) throw new RequestError('השקף לא נמצא.', 404)
  const columns = 'id,lecture_id,position,title,source_text,source_notes,intent_notes,image_path,planned_seconds,sentences(text,position,starts_paragraph)'
  const rows = await db.many<unknown>(`slides?lecture_id=eq.${own.lecture_id}&select=${columns}&order=position`)
  return rows.flatMap((row): SlideRow[] => {
    if (!isObject(row)) return []
    return [
      {
        id: text(row.id),
        lecture_id: text(row.lecture_id),
        position: num(row.position) ?? 0,
        title: text(row.title) || null,
        source_text: text(row.source_text) || null,
        source_notes: text(row.source_notes) || null,
        intent_notes: text(row.intent_notes) || null,
        image_path: text(row.image_path) || null,
        planned_seconds: num(row.planned_seconds),
        sentences: list(row.sentences).flatMap((s) =>
          isObject(s) && text(s.text) ? [{ text: text(s.text), position: num(s.position) ?? 0, starts_paragraph: s.starts_paragraph === true }] : [],
        ),
      },
    ]
  })
}

/** The script as the editor shows it: sentences joined, a new line where a paragraph starts. */
function scriptOf(slide: SlideRow): string {
  return [...slide.sentences]
    .sort((a, b) => a.position - b.position)
    .map((s, i) => (i === 0 ? s.text : `${s.starts_paragraph ? '\n' : ' '}${s.text}`))
    .join('')
}

/** The slide's picture for Gemini, or null when it has none, is too big or cannot be read. */
async function slideImage(db: ReturnType<typeof userDb>, path: string | null): Promise<{ mime_type: string; data: string } | null> {
  if (!path) return null
  try {
    const bytes = await db.download('slides', path)
    if (bytes.byteLength > MAX_IMAGE_BYTES) return null
    const mime = path.endsWith('.webp') ? 'image/webp' : path.endsWith('.png') ? 'image/png' : 'image/jpeg'
    return { mime_type: mime, data: toBase64(bytes) }
  } catch {
    return null
  }
}

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000))
  return btoa(binary)
}
