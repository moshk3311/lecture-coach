import { describe, expect, it } from 'vitest'
import { formatClock } from './format'

describe('formatClock', () => {
  it('formats m:ss and switches to h:mm:ss from an hour', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(59.9)).toBe('0:59')
    expect(formatClock(240)).toBe('4:00')
    expect(formatClock(3725)).toBe('1:02:05')
  })

  it('clamps negative values to zero', () => {
    expect(formatClock(-5)).toBe('0:00')
  })
})
