// User authorization for Edge Functions.
//
// The platform's verify_jwt flag is not enough on its own: it lets the public publishable key
// (and the legacy anon JWT) through, and it only understands legacy HS256 keys while this project
// signs user sessions with ES256. So functions run with verify_jwt = false and call requireUser(),
// which asks Supabase Auth whether the bearer token is a live user session.
import { errorJson } from './http.ts'

export type AuthedUser = { id: string; email: string | null; token: string }

/** The project's publishable key, sent as `apikey` next to a user's token. */
export function projectApiKey(): string {
  const keys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>
    if (parsed.default) return parsed.default
  }
  return Deno.env.get('SUPABASE_ANON_KEY') ?? ''
}

/** Returns the calling user, or a ready-to-send 401 response. */
export async function requireUser(req: Request): Promise<AuthedUser | Response> {
  const unauthorized = () => errorJson('נדרשת התחברות.', 401)

  const header = req.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
  // API keys (sb_publishable_/sb_secret_) are not user sessions.
  if (!token || token.startsWith('sb_')) return unauthorized()

  let res: Response
  try {
    res = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: projectApiKey() },
    })
  } catch (err) {
    console.error('auth check failed', err)
    return errorJson('בדיקת ההתחברות נכשלה. נסה שוב בעוד רגע.', 503)
  }
  if (!res.ok) return unauthorized()

  const user = (await res.json()) as { id?: string; email?: string; role?: string }
  if (!user.id || user.role !== 'authenticated') return unauthorized()
  return { id: user.id, email: user.email ?? null, token }
}
