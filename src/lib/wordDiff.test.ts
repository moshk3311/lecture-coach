import { describe, expect, it } from 'vitest'
import { wordDiff } from './wordDiff'

describe('wordDiff', () => {
  it('marks replaced words as removed, then added', () => {
    expect(wordDiff("It's worth to check the numbers.", "It's worth checking the numbers.")).toEqual([
      { kind: 'same', text: "It's worth" },
      { kind: 'removed', text: 'to check' },
      { kind: 'added', text: 'checking' },
      { kind: 'same', text: 'the numbers.' },
    ])
  })

  it('returns one kept part when nothing changed, ignoring extra spaces', () => {
    expect(wordDiff('We  run it.', 'We run it.')).toEqual([{ kind: 'same', text: 'We run it.' }])
  })

  it('keeps paragraph breaks as their own parts', () => {
    expect(wordDiff('One here.\nTwo there.', 'One here.\nTwo over there.')).toEqual([
      { kind: 'same', text: 'One here.' },
      { kind: 'same', text: '\n' },
      { kind: 'same', text: 'Two' },
      { kind: 'added', text: 'over' },
      { kind: 'same', text: 'there.' },
    ])
  })

  it('handles a split sentence and words cut at the end', () => {
    expect(wordDiff('We start and we finish late', 'We start. We finish')).toEqual([
      { kind: 'same', text: 'We' },
      { kind: 'removed', text: 'start and we' },
      { kind: 'added', text: 'start. We' },
      { kind: 'same', text: 'finish' },
      { kind: 'removed', text: 'late' },
    ])
  })

  it('handles empty texts', () => {
    expect(wordDiff('', 'Hello.')).toEqual([{ kind: 'added', text: 'Hello.' }])
    expect(wordDiff('Hello.', '')).toEqual([{ kind: 'removed', text: 'Hello.' }])
    expect(wordDiff('', '')).toEqual([])
  })
})
