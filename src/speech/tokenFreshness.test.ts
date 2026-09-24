import { describe, expect, it } from 'vitest'
import { TOKEN_REFRESH_MS, isTokenFresh } from './tokenFreshness'

describe('isTokenFresh', () => {
  const fetchedAt = 1_000_000

  it('reuses a token for the first 9 minutes', () => {
    expect(isTokenFresh(fetchedAt, fetchedAt)).toBe(true)
    expect(isTokenFresh(fetchedAt, fetchedAt + TOKEN_REFRESH_MS - 1)).toBe(true)
  })

  it('asks for a new token from minute 9 on, before Azure expires it at 10', () => {
    expect(TOKEN_REFRESH_MS).toBe(9 * 60 * 1000)
    expect(isTokenFresh(fetchedAt, fetchedAt + TOKEN_REFRESH_MS)).toBe(false)
  })
})
