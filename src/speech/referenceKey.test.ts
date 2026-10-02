import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { referenceKey } from './referenceKey'

describe('referenceKey', () => {
  it('is the hex sha256 of text|voice|rate', async () => {
    const expected = createHash('sha256').update('put AI to work|en-US-AndrewNeural|').digest('hex')
    expect(await referenceKey('put AI to work', 'en-US-AndrewNeural')).toBe(expected)
  })

  it('ignores extra whitespace but not voice or rate', async () => {
    const key = await referenceKey('put AI to work', 'en-US-AndrewNeural')
    expect(await referenceKey('  put  AI\nto work ', 'en-US-AndrewNeural')).toBe(key)
    expect(await referenceKey('put AI to work', 'en-US-AvaNeural')).not.toBe(key)
    expect(await referenceKey('put AI to work', 'en-US-AndrewNeural', '-25%')).not.toBe(key)
  })
})
