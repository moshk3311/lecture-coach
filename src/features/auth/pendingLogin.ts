// Remembers that a login email was sent, so the code screen survives an app reload
// (iOS often reloads an installed PWA after you switch to Mail to copy the code).

const PENDING_KEY = 'lc.pendingLogin'
const LAST_EMAIL_KEY = 'lc.lastEmail'
/** Supabase email OTPs expire after an hour. */
const PENDING_TTL_MS = 60 * 60 * 1000

export type PendingLogin = { email: string; sentAt: number }

export function savePendingLogin(pending: PendingLogin): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
    localStorage.setItem(LAST_EMAIL_KEY, pending.email)
  } catch {
    // Storage can be unavailable (private mode); the flow still works without it.
  }
}

export function loadPendingLogin(now = Date.now()): PendingLogin | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingLogin>
    if (typeof parsed.email !== 'string' || typeof parsed.sentAt !== 'number') return null
    if (now - parsed.sentAt > PENDING_TTL_MS) return null
    return { email: parsed.email, sentAt: parsed.sentAt }
  } catch {
    return null
  }
}

export function clearPendingLogin(): void {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    // ignore
  }
}

export function lastUsedEmail(): string {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}
