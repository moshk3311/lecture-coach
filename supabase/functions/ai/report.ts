// run_report (ARCHITECTURE §5.7, §7): Gemini reviews one saved take, its measured facts and, when
// the owner allows it, the recording. The checked report is saved in attempts.ai_feedback.
import type { AuthedUser } from '../_shared/auth.ts'
import { userDb } from '../_shared/userDb.ts'
import { normalizeRunReport, RUN_REPORT_SCHEMA, type RunReportFeedback } from './contract.ts'
import { generateJson, type GeminiConfig, type Part, uploadFile } from './gemini.ts'
import { PROMPT_VERSION } from './prompts/coach.ts'
import { RUN_REPORT_SYSTEM, runReportPrompt } from './prompts/runReport.ts'
import { type AttemptRow, type LectureRow, reportInput } from './reportInput.ts'
import { idField, RequestError } from './request.ts'

const ATTEMPT_COLUMNS = 'id,mode,lecture_id,reference_text,audio_path,duration_sec,metrics,pron_score,accuracy,fluency,prosody'

export async function runReport(user: AuthedUser, payload: unknown, gemini: GeminiConfig): Promise<RunReportFeedback> {
  const db = userDb(user)
  const attempt = await db.one<AttemptRow>(`attempts?id=eq.${idField(payload, 'attempt_id')}&select=${ATTEMPT_COLUMNS}`)
  if (!attempt || attempt.mode !== 'full_run') throw new RequestError('החזרה לא נמצאה.', 404)

  const [lecture, settings] = await Promise.all([
    attempt.lecture_id ? db.one<LectureRow>(`lectures?id=eq.${attempt.lecture_id}&select=title,audience,target_minutes`) : null,
    db.one<{ send_audio_to_llm: boolean }>('user_settings?select=send_audio_to_llm'),
  ])
  // The recording goes to Gemini only while the owner allows it (§9) and while it is kept (§6).
  const withAudio = (settings?.send_audio_to_llm ?? true) && Boolean(attempt.audio_path)
  const input = reportInput(attempt, lecture, withAudio)

  // Gemini reads a file best when it comes before the text about it.
  const parts: Part[] = []
  if (withAudio) {
    const wav = await db.download('recordings', attempt.audio_path!)
    parts.push({ file_data: await uploadFile(gemini, wav, 'audio/wav', `take-${attempt.id}`) })
  }
  parts.push({ text: runReportPrompt(input) })

  const answer = await generateJson(gemini, { system: RUN_REPORT_SYSTEM, parts, schema: RUN_REPORT_SCHEMA })
  const report = normalizeRunReport(answer, {
    heardAudio: withAudio,
    slideCount: Math.max(0, ...input.slides.map((slide) => slide.position)),
    durationSec: input.durationSec,
    model: gemini.model,
    promptVersion: PROMPT_VERSION,
    createdAt: new Date().toISOString(),
  })
  await db.update(`attempts?id=eq.${attempt.id}`, { ai_feedback: report })
  return report
}
