import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchTakeSlice, sliceWav, wavByteRange } from './slice'
import { encodeWav, parseWav } from './wav'

/** One second of 16 kHz audio whose sample values are their own index. */
const second = encodeWav(Int16Array.from({ length: 16_000 }, (_, i) => i), 16_000)

const samplesOf = (wav: ArrayBuffer) => Array.from(new Int16Array(parseWav(wav).data))

describe('wavByteRange', () => {
  it('maps milliseconds to the sample bytes after the 44-byte header', () => {
    expect(wavByteRange(0, 1000)).toEqual({ from: 44, to: 44 + 32_000 - 1 })
    expect(wavByteRange(250, 500)).toEqual({ from: 44 + 8_000, to: 44 + 16_000 - 1 })
  })

  it('always covers at least one sample and never starts before the audio', () => {
    expect(wavByteRange(500, 500)).toEqual({ from: 16_044, to: 16_045 })
    expect(wavByteRange(-200, 0)).toEqual({ from: 44, to: 45 })
  })
})

describe('sliceWav', () => {
  it('cuts the samples between the two times', () => {
    const samples = samplesOf(sliceWav(second, 250, 500))
    expect(samples).toHaveLength(4_000)
    expect(samples[0]).toBe(4_000)
    expect(samples.at(-1)).toBe(7_999)
  })

  it('stops at the end of the recording', () => {
    expect(samplesOf(sliceWav(second, 900, 2_000))).toHaveLength(1_600)
    expect(samplesOf(sliceWav(second, 3_000, 4_000))).toHaveLength(0)
  })
})

describe('fetchTakeSlice', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks for the byte range and wraps the partial content in a WAV', async () => {
    const fetchMock = vi.fn(async () => new Response(new Int16Array([100, 200, 300]).buffer, { status: 206 }))
    vi.stubGlobal('fetch', fetchMock)
    const blob = await fetchTakeSlice('https://storage.test/take.wav', 250, 500)
    expect(fetchMock).toHaveBeenCalledWith('https://storage.test/take.wav', { headers: { Range: 'bytes=8044-16043' } })
    expect(blob.type).toBe('audio/wav')
    expect(samplesOf(await blob.arrayBuffer())).toEqual([100, 200, 300])
  })

  it('slices the whole file when the server ignores the range', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(second, { status: 200 })))
    const samples = samplesOf(await (await fetchTakeSlice('https://storage.test/take.wav', 250, 500)).arrayBuffer())
    expect(samples).toHaveLength(4_000)
    expect(samples[0]).toBe(4_000)
  })

  it('fails on an error status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gone', { status: 404 })))
    await expect(fetchTakeSlice('https://storage.test/take.wav', 0, 100)).rejects.toThrow('404')
  })
})
