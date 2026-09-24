import { describe, expect, it } from 'vitest'
import { scoreBand } from './scoreBands'

describe('scoreBand', () => {
  it('uses the spec thresholds: ≥ 85 good, 60–84 warn, < 60 bad', () => {
    expect(scoreBand(100)).toBe('good')
    expect(scoreBand(85)).toBe('good')
    expect(scoreBand(84.9)).toBe('warn')
    expect(scoreBand(60)).toBe('warn')
    expect(scoreBand(59.9)).toBe('bad')
    expect(scoreBand(0)).toBe('bad')
  })
})
