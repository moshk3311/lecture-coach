export type ParsedWav = {
  sampleRate: number
  channels: number
  bitsPerSample: number
  /** Raw sample bytes from the data chunk (PCM). */
  data: ArrayBuffer
}

function fourCC(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  )
}

/** Reads a RIFF/WAVE buffer: format fields plus the PCM bytes of its data chunk. */
export function parseWav(buffer: ArrayBuffer): ParsedWav {
  const view = new DataView(buffer)
  if (buffer.byteLength < 12 || fourCC(view, 0) !== 'RIFF' || fourCC(view, 8) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE buffer')
  }

  let format: Omit<ParsedWav, 'data'> | null = null
  let offset = 12
  while (offset + 8 <= buffer.byteLength) {
    const id = fourCC(view, offset)
    const declared = view.getUint32(offset + 4, true)
    const start = offset + 8
    // Streaming encoders may write a placeholder size; clamp to what is actually there.
    const size = Math.min(declared, buffer.byteLength - start)

    if (id === 'fmt ') {
      format = {
        channels: view.getUint16(start + 2, true),
        sampleRate: view.getUint32(start + 4, true),
        bitsPerSample: view.getUint16(start + 14, true),
      }
    } else if (id === 'data') {
      if (!format) throw new Error('WAV data chunk before fmt chunk')
      return { ...format, data: buffer.slice(start, start + size) }
    }
    // Chunks are word-aligned: odd sizes carry one pad byte.
    offset = start + size + (size % 2)
  }
  throw new Error('WAV has no data chunk')
}

/** Joins PCM16 mono chunks into one buffer. */
export function concatPcm(chunks: Int16Array[]): Int16Array {
  const out = new Int16Array(chunks.reduce((n, c) => n + c.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

/** A RIFF/WAVE file for PCM16 mono samples (recordings are 16 kHz, ARCHITECTURE §5.3). */
export function encodeWav(pcm: Int16Array, sampleRate: number): ArrayBuffer {
  const dataBytes = pcm.length * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < 4; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  ascii(36, 'data')
  view.setUint32(40, dataBytes, true)
  new Int16Array(buffer, 44).set(pcm)
  return buffer
}
