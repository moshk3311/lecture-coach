/** Azure tokens live ~10 minutes; we refresh after 9 (ARCHITECTURE §7). */
export const TOKEN_REFRESH_MS = 9 * 60 * 1000

export function isTokenFresh(fetchedAt: number, now: number): boolean {
  return now - fetchedAt < TOKEN_REFRESH_MS
}
