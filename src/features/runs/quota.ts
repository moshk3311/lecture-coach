// Quota guard (ARCHITECTURE §5.3): warn at 80% of the monthly Azure minutes, block at 98%.

export type QuotaState = 'ok' | 'warn' | 'blocked'

export function quotaState(minutes: number, cap: number): QuotaState {
  if (cap <= 0) return 'ok'
  const share = minutes / cap
  if (share >= 0.98) return 'blocked'
  if (share >= 0.8) return 'warn'
  return 'ok'
}
