// azure-token — mints a short-lived Azure Speech token for the logged-in user (ARCHITECTURE §7).
// Deployed with verify_jwt = false; requireUser() does the real check (see _shared/auth.ts).
import { requireUser } from '../_shared/auth.ts'
import { corsHeaders, errorJson, json } from '../_shared/http.ts'

// Azure tokens live ~10 minutes; the client refreshes at 9.
const TOKEN_TTL_MS = 10 * 60 * 1000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return errorJson('שיטה לא נתמכת.', 405)

  const user = await requireUser(req)
  if (user instanceof Response) return user

  const key = Deno.env.get('AZURE_SPEECH_KEY')
  const region = Deno.env.get('AZURE_SPEECH_REGION')
  if (!key || !region) {
    return errorJson('בשרת חסרים הסודות AZURE_SPEECH_KEY / AZURE_SPEECH_REGION.', 500)
  }

  let res: Response
  try {
    res = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' },
    })
  } catch (err) {
    console.error('issueToken network error', err)
    return errorJson('אין חיבור ל-Azure כרגע. נסה שוב בעוד רגע.', 502)
  }

  if (!res.ok) {
    console.error('issueToken failed', res.status, await res.text())
    const rejected = res.status === 401 || res.status === 403
    return errorJson(
      rejected
        ? 'Azure דחה את המפתח. בדוק את AZURE_SPEECH_KEY ואת AZURE_SPEECH_REGION.'
        : 'Azure לא הנפיק טוקן. נסה שוב בעוד רגע.',
      502,
      { azure_status: res.status },
    )
  }

  const token = await res.text()
  return json({ token, region, expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString() })
})
