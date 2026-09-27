import { describe, expect, it } from 'vitest'
import { createDownsampler, rmsLevel, toInt16 } from './resample'

const constant = (length: number, value: number) => new Float32Array(length).fill(value)

describe('toInt16', () => {
  it('maps [-1, 1] to the full 16-bit range and clamps', () => {
    expect(toInt16(0)).toBe(0)
    expect(toInt16(1)).toBe(32767)
    expect(toInt16(-1)).toBe(-32768)
    expect(toInt16(2)).toBe(32767)
  })
})

describe('createDownsampler', () => {
  it('turns one second at 48 kHz or 44.1 kHz into one second at 16 kHz', () => {
    expect(createDownsampler(48_000)(constant(48_000, 0.5))).toHaveLength(16_000)
    expect(createDownsampler(44_100)(constant(44_100, 0.5))).toHaveLength(16_000)
    expect(createDownsampler(16_000)(constant(16_000, 0.5))).toHaveLength(16_000)
  })

  it('keeps the level of the signal', () => {
    const out = createDownsampler(48_000)(constant(4800, 0.5))
    expect(out.every((s) => s === toInt16(0.5))).toBe(true)
  })

  it('gives the same samples whether the audio arrives at once or in 128-sample chunks', () => {
    const input = Float32Array.from({ length: 44_100 }, (_, i) => Math.sin((2 * Math.PI * 220 * i) / 44_100))
    const whole = createDownsampler(44_100)(input)
    const chunked = createDownsampler(44_100)
    const parts: number[] = []
    for (let i = 0; i < input.length; i += 128) parts.push(...chunked(input.subarray(i, i + 128)))
    expect(Int16Array.from(parts)).toEqual(whole)
  })

  it('refuses to upsample', () => {
    expect(() => createDownsampler(8000)).toThrow()
  })
})

describe('rmsLevel', () => {
  it('is 0 for silence and about 0.5 for a half-scale constant', () => {
    expect(rmsLevel(new Int16Array(100))).toBe(0)
    expect(rmsLevel(new Int16Array(100).fill(16384))).toBeCloseTo(0.5, 3)
    expect(rmsLevel(new Int16Array(0))).toBe(0)
  })
})
