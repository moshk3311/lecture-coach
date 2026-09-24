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
