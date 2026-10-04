// ai — the app's language-model actions (ARCHITECTURE §7): one function with an action router.
// Deployed with verify_jwt = false; requireUser() does the real check (see _shared/auth.ts).
import { type AuthedUser, requireUser } from '../_shared/auth.ts'
import { corsHeaders, errorJson, json } from '../_shared/http.ts'
import { InvalidAnswer } from './contract.ts'
import { type GeminiConfig, geminiConfig, GeminiError } from './gemini.ts'
import { keywords } from './keywords.ts'
import { runReport } from './report.ts'
import { RequestError } from './request.ts'
import { speak } from './speech.ts'

type Action = (user: AuthedUser, payload: unknown, gemini: GeminiConfig) => Promise<unknown>

const ACTIONS = new Map<string, Action>([
  ['keywords', keywords],
  ['run_report', runReport],
  ['speak', speak],
])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorJson('שיטה לא נתמכת.', 405)

  const user = await requireUser(req)
  if (user instanceof Response) return user

  const body = (await req.json().catch(() => null)) as { action?: unknown; payload?: unknown } | null
  const name = typeof body?.action === 'string' ? body.action : ''
  const action = ACTIONS.get(name)
  if (!action) return errorJson('פעולה לא מוכרת.', 400)

  const gemini = geminiConfig()
  if (!gemini) return errorJson('בשרת חסרים הסודות GEMINI_API_KEY / GEMINI_MODEL.', 500)

  try {
    return json(await action(user, body?.payload, gemini))
  } catch (err) {
    if (err instanceof RequestError) return errorJson(err.message, err.status)
    console.error(`ai ${name} failed`, err)
    return errorJson(failureMessage(name, err), 503)
  }
})

/** Every Gemini failure is a 503 with a Hebrew message (§7); the app keeps showing what it has. */
function failureMessage(action: string, err: unknown): string {
  if (err instanceof GeminiError) {
    // The voice has its own free quota. Without a billing account nothing is charged: it just fails.
    if (action === 'speak' && (err.status === 429 || err.status === 404)) {
      return 'הקול של Gemini לא זמין כרגע: המכסה החינמית נגמרה או שהמודל לא זמין בה. נסה שוב מאוחר יותר.'
    }
    if (err.status === 429) return 'Gemini עמוס או שהמכסה היומית נגמרה. נסה שוב מאוחר יותר.'
    if (err.status === 401 || err.status === 403) return 'Gemini דחה את המפתח. בדוק את GEMINI_API_KEY.'
    if (err.status === 404) return 'Gemini לא מכיר את המודל שב-GEMINI_MODEL.'
  }
  if (err instanceof InvalidAnswer) return 'Gemini החזיר תשובה לא שמישה. נסה שוב.'
  return 'שירות ה-AI לא זמין כרגע. נסה שוב בעוד רגע.'
}
