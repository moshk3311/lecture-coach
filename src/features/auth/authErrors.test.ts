import { describe, expect, it } from 'vitest'
import { authErrorFromUrl, authErrorMessage } from './authErrors'

describe('authErrorMessage', () => {
  it('maps known Supabase error codes to Hebrew', () => {
    expect(authErrorMessage({ code: 'otp_expired', status: 403 })).toContain('פג תוקפו')
    expect(authErrorMessage({ code: 'over_email_send_rate_limit', status: 429 })).toContain('יותר מדי מיילים')
  })

  it('treats fetch failures as a network problem', () => {
    expect(authErrorMessage({ name: 'AuthRetryableFetchError', status: 0 })).toContain('אין חיבור')
  })

  it('falls back to rate-limit text for unknown 429s and a generic message otherwise', () => {
    expect(authErrorMessage({ status: 429 })).toContain('יותר מדי ניסיונות')
    expect(authErrorMessage({ code: 'something_new', status: 500 })).toBe('משהו השתבש. נסה שוב.')
  })
})

describe('authErrorFromUrl', () => {
  it('returns null when the URL carries no auth error', () => {
    expect(authErrorFromUrl('?code=abc', '#/')).toBeNull()
    expect(authErrorFromUrl('', '#/settings')).toBeNull()
  })

  it('reads PKCE errors from the query string', () => {
    const search = '?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'
    expect(authErrorFromUrl(search)).toContain('הקישור פג תוקף')
  })

  it('reads implicit-flow errors from the hash but ignores router hashes', () => {
    expect(authErrorFromUrl('', '#error=access_denied&error_code=signup_disabled')).toContain('ההרשמה סגורה')
    expect(authErrorFromUrl('', '#/login')).toBeNull()
  })
})
