import { describe, expect, it } from 'vitest'
import { anchorSpan } from './anchor'

describe('anchorSpan', () => {
  it('widens Gemini times by 0.5 s on each side', () => {
    expect(anchorSpan({ startSec: 12, endSec: 13 }, 60_000)).toEqual({ startMs: 11_500, endMs: 13_500 })
  })

  it('keeps the span inside the recording', () => {
    expect(anchorSpan({ startSec: 0.2, endSec: 0.4 }, 1_000)).toEqual({ startMs: 0, endMs: 900 })
    expect(anchorSpan({ startSec: 9.8, endSec: 10.4 }, 10_000)).toEqual({ startMs: 9_300, endMs: 10_000 })
    expect(anchorSpan({ startSec: 30, endSec: 31 }, 10_000)).toEqual({ startMs: 9_500, endMs: 10_000 })
  })

  it('reads an end before the start as a point in time', () => {
    expect(anchorSpan({ startSec: 5, endSec: 4 }, 60_000)).toEqual({ startMs: 4_500, endMs: 5_500 })
  })

  it('has nothing to anchor to without valid times', () => {
    expect(anchorSpan({ startSec: Number.NaN, endSec: 1 }, 60_000)).toBeNull()
    expect(anchorSpan({ startSec: 1, endSec: Number.POSITIVE_INFINITY }, 60_000)).toBeNull()
    expect(anchorSpan({ startSec: 1, endSec: 2 }, 0)).toBeNull()
  })
})
