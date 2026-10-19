import { describe, expect, it } from 'vitest'
import { americanizePrompt } from './americanize.ts'

describe('americanizePrompt', () => {
  it('sends the script and says whether there is a bridge sentence', () => {
    expect(americanizePrompt('We open the computer.', 'Now we pass to safety.')).toBe(
      'Script:\nWe open the computer.\n\nBridge sentence into the next slide: Now we pass to safety.',
    )
    expect(americanizePrompt('We open the computer.', null)).toContain('Bridge sentence: none.')
  })
})
