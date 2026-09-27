import { describe, expect, it } from 'vitest'
import { quotaState } from './quota'

describe('quotaState', () => {
  it('warns from 80% and blocks from 98% of the monthly cap', () => {
    expect(quotaState(0, 300)).toBe('ok')
    expect(quotaState(239, 300)).toBe('ok')
    expect(quotaState(240, 300)).toBe('warn')
    expect(quotaState(294, 300)).toBe('blocked')
    expect(quotaState(10, 0)).toBe('ok')
  })
})
