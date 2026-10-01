// A slice of a take for ▶ You (ARCHITECTURE §5.7). Takes are 16 kHz mono PCM16 WAVs with a 44-byte
// header (encodeWav), so a time range maps straight to a byte range: only those bytes are downloaded.
import { encodeWav, parseWav } from './wav'

export const TAKE_FORMAT = { sampleRate: 16_000, headerBytes: 44 } as const
const BYTES_PER_SAMPLE = 2

/** Inclusive byte range of the samples from startMs to endMs, for an HTTP Range request. */
export function wavByteRange(startMs: number, endMs: number): { from: number; to: number } {
  const first = Math.max(0, Math.floor((startMs * TAKE_FORMAT.sampleRate) / 1000))
  const end = Math.max(first + 1, Math.ceil((endMs * TAKE_FORMAT.sampleRate) / 1000))
  return {
    from: TAKE_FORMAT.headerBytes + first * BYTES_PER_SAMPLE,
    to: TAKE_FORMAT.headerBytes + end * BYTES_PER_SAMPLE - 1,
  }
}

/** The part of a whole WAV from startMs to endMs, as a WAV of its own. */
export function sliceWav(wav: ArrayBuffer, startMs: number, endMs: number): ArrayBuffer {
  const { data, sampleRate } = parseWav(wav)
  const samples = new Int16Array(data, 0, data.byteLength >> 1)
  const first = Math.min(samples.length, Math.max(0, Math.floor((startMs * sampleRate) / 1000)))
  const end = Math.min(samples.length, Math.max(first, Math.ceil((endMs * sampleRate) / 1000)))
  return encodeWav(samples.slice(first, end), sampleRate)
}

/**
 * Downloads only the bytes of [startMs, endMs] of a take and wraps them in a WAV. A server that
 * ignores the Range header sends the whole file, which is then sliced here.
 */
export async function fetchTakeSlice(url: string, startMs: number, endMs: number): Promise<Blob> {
  const { from, to } = wavByteRange(startMs, endMs)
  const res = await fetch(url, { headers: { Range: `bytes=${from}-${to}` } })
  if (!res.ok) throw new Error(`recording request failed: ${res.status}`)
  const bytes = await res.arrayBuffer()
  const wav =
    res.status === 206
      ? encodeWav(new Int16Array(bytes, 0, bytes.byteLength >> 1), TAKE_FORMAT.sampleRate)
      : sliceWav(bytes, startMs, endMs)
  return new Blob([wav], { type: 'audio/wav' })
}
