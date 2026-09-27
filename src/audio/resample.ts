// Microphone audio → 16 kHz mono PCM16, the format Azure pronunciation assessment takes
// (ARCHITECTURE §5.3). Pure, so it runs inside the AudioWorklet and in unit tests alike.

export const TARGET_RATE = 16_000

/** Float sample in [-1, 1] → signed 16-bit. */
export function toInt16(sample: number): number {
  const s = Math.max(-1, Math.min(1, sample))
  return Math.round(s < 0 ? s * 0x8000 : s * 0x7fff)
}

/**
 * A streaming downsampler: each output sample is the average of the input samples in its
 * window (a box filter, enough to keep speech clean). State carries across chunks, so feeding
 * audio in pieces gives the same result as feeding it at once.
 */
export function createDownsampler(inputRate: number, outputRate = TARGET_RATE): (input: Float32Array) => Int16Array {
  if (inputRate < outputRate) throw new Error(`Cannot downsample ${inputRate} Hz to ${outputRate} Hz`)
  const ratio = inputRate / outputRate
  let consumed = 0
  let nextEnd = ratio
  let sum = 0
  let count = 0

  return (input) => {
    const out = new Int16Array(Math.ceil((consumed + input.length - nextEnd) / ratio) + 1)
    let n = 0
    for (let i = 0; i < input.length; i++) {
      sum += input[i]!
      count++
      if (consumed + i + 1 >= nextEnd) {
        out[n++] = toInt16(sum / count)
        sum = 0
        count = 0
        nextEnd += ratio
      }
    }
    consumed += input.length
    return out.slice(0, n)
  }
}

/** Root-mean-square level of PCM16 samples, 0..1 (for the microphone meter). */
export function rmsLevel(pcm: Int16Array): number {
  if (!pcm.length) return 0
  let sum = 0
  for (const s of pcm) sum += (s / 0x8000) ** 2
  return Math.sqrt(sum / pcm.length)
}
