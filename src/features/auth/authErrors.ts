/** Subset of Supabase's AuthError that the UI cares about. */
export type AuthErrorLike = { code?: string; status?: number; name?: string }

const MESSAGES: Record<string, string> = {
  over_email_send_rate_limit: 'נשלחו יותר מדי מיילים. אפשר לנסות שוב בעוד כמה דקות.',
  over_request_rate_limit: 'יותר מדי ניסיונות. חכה רגע ונסה שוב.',
  otp_expired: 'הקוד שגוי או שפג תוקפו. בקש קוד חדש.',
  signup_disabled: 'ההרשמה סגורה. אפשר להיכנס רק עם החשבון הקיים.',
  email_address_not_authorized:
    'שירות המייל של Supabase שולח רק לחברי הצוות של הפרויקט. בדוק שזו הכתובת של החשבון שלך.',
  email_address_invalid: 'כתובת המייל לא תקינה.',
  validation_failed: 'כתובת המייל לא תקינה.',
  user_banned: 'החשבון חסום.',
}

const NETWORK = 'אין חיבור לשרת. בדוק את האינטרנט ונסה שוב.'
const FALLBACK = 'משהו השתבש. נסה שוב.'

/** Hebrew message for a Supabase auth error. */
export function authErrorMessage(error: AuthErrorLike): string {
  const known = error.code ? MESSAGES[error.code] : undefined
  if (known) return known
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return NETWORK
  if (error.status === 429) return MESSAGES.over_request_rate_limit ?? FALLBACK
  return FALLBACK
}

/**
 * Supabase appends errors to the redirect URL when a magic link fails
 * (e.g. ?error_code=otp_expired). PKCE puts them in the query; older flows in the hash.
 */
export function authErrorFromUrl(search: string, hash = ''): string | null {
  const fromHash = hash.startsWith('#/') ? '' : hash.replace(/^#/, '')
  for (const source of [search, fromHash]) {
    const params = new URLSearchParams(source)
    const code = params.get('error_code')
    if (!code && !params.get('error_description') && !params.get('error')) continue
    if (code === 'otp_expired') return 'הקישור פג תוקף או שכבר נוצל. בקש קישור חדש.'
    return authErrorMessage({ code: code ?? undefined })
  }
  return null
}
