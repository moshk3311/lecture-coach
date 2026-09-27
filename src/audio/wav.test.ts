import { describe, expect, it } from 'vitest'
import { concatPcm, encodeWav, parseWav } from './wav'

type Chunk = { id: string; bytes: Uint8Array; declaredSize?: number }

function writeFourCC(view: DataView, offset: number, id: string) {
  for (let i = 0; i < 4; i++) view.setUint8(offset + i, id.charCodeAt(i))
}

function fmtChunk(sampleRate: number, channels: number, bits: number): Chunk {
  const bytes = new Uint8Array(16)
  const view = new DataView(bytes.buffer)
  view.setUint16(0, 1, true) // PCM
  view.setUint16(2, channels, true)
  view.setUint32(4, sampleRate, true)
  view.setUint32(8, (sampleRate * channels * bits) / 8, true)
  view.setUint16(12, (channels * bits) / 8, true)
  view.setUint16(14, bits, true)
  return { id: 'fmt ', bytes }
}

function buildWav(chunks: Chunk[]): ArrayBuffer {
  const padded = chunks.map((c) => c.bytes.length + (c.bytes.length % 2))
  const total = 12 + padded.reduce((sum, n) => sum + 8 + n, 0)
  const buffer = new ArrayBuffer(total)
  const view = new DataView(buffer)
  writeFourCC(view, 0, 'RIFF')
  view.setUint32(4, total - 8, true)
  writeFourCC(view, 8, 'WAVE')
  let offset = 12
  chunks.forEach((chunk, i) => {
    writeFourCC(view, offset, chunk.id)
    view.setUint32(offset + 4, chunk.declaredSize ?? chunk.bytes.length, true)
    new Uint8Array(buffer, offset + 8, chunk.bytes.length).set(chunk.bytes)
    offset += 8 + (padded[i] ?? 0)
  })
  return buffer
}

describe('parseWav', () => {
  it('returns the format and the PCM bytes of the data chunk', () => {
    const samples = new Uint8Array([1, 2, 3, 4, 5, 6])
    const wav = parseWav(buildWav([fmtChunk(16000, 1, 16), { id: 'data', bytes: samples }]))
    expect(wav).toMatchObject({ sampleRate: 16000, channels: 1, bitsPerSample: 16 })
    expect(new Uint8Array(wav.data)).toEqual(samples)
  })

  it('skips extra chunks, including odd-sized ones with a pad byte', () => {
    const samples = new Uint8Array([9, 8, 7, 6])
    const wav = parseWav(
      buildWav([fmtChunk(24000, 1, 16), { id: 'LIST', bytes: new Uint8Array([1, 2, 3]) }, { id: 'data', bytes: samples }]),
    )
    expect(wav.sampleRate).toBe(24000)
    expect(new Uint8Array(wav.data)).toEqual(samples)
  })

  it('clamps a placeholder data size from streaming encoders', () => {
    const samples = new Uint8Array([4, 4, 4, 4])
    const wav = parseWav(buildWav([fmtChunk(16000, 1, 16), { id: 'data', bytes: samples, declaredSize: 0xffffffff }]))
    expect(new Uint8Array(wav.data)).toEqual(samples)
  })

  it('rejects buffers that are not WAV', () => {
    expect(() => parseWav(new TextEncoder().encode('ID3 not a wav file').buffer)).toThrow('Not a RIFF/WAVE buffer')
  })
})

describe('encodeWav', () => {
  it('round-trips through parseWav', () => {
    const pcm = concatPcm([Int16Array.from([1, -2, 3]), Int16Array.from([32767, -32768])])
    const wav = encodeWav(pcm, 16000)
    expect(wav.byteLength).toBe(44 + 10)
    const parsed = parseWav(wav)
    expect(parsed).toMatchObject({ sampleRate: 16000, channels: 1, bitsPerSample: 16 })
    expect(new Int16Array(parsed.data)).toEqual(pcm)
  })
})
