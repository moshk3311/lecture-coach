export type ScoreBand = 'good' | 'warn' | 'bad'

/** Color bands from ARCHITECTURE §5.3: ≥ 85 green · 60–84 amber · < 60 red. */
export function scoreBand(score: number): ScoreBand {
  if (score >= 85) return 'good'
  if (score >= 60) return 'warn'
  return 'bad'
}
