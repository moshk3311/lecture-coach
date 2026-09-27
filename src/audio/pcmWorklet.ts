// AudioWorklet processor: microphone → 16 kHz PCM16 chunks (about 100 ms each) for the main thread.
// Bundled on its own by Vite (imported with ?worker&url) and loaded with audioWorklet.addModule.
import { createDownsampler, rmsLevel, TARGET_RATE } from './resample'

// AudioWorkletGlobalScope is not part of the DOM typings.
declare const sampleRate: number
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}

export type WorkletMessage = { type: 'chunk'; pcm: Int16Array; level: number } | { type: 'flushed' }

const CHUNK_SAMPLES = TARGET_RATE / 10

class PcmRecorder extends AudioWorkletProcessor {
  private readonly downsample = createDownsampler(sampleRate)
  private parts: Int16Array[] = []
  private size = 0
  private stopped = false

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<string>) => {
      if (event.data !== 'flush') return
      this.post()
      this.stopped = true
      this.port.postMessage({ type: 'flushed' } satisfies WorkletMessage)
    }
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (channel && !this.stopped) {
      const pcm = this.downsample(channel)
      this.parts.push(pcm)
      this.size += pcm.length
      if (this.size >= CHUNK_SAMPLES) this.post()
    }
    return !this.stopped
  }

  private post() {
    if (!this.size) return
    const pcm = new Int16Array(this.size)
    let offset = 0
    for (const part of this.parts) {
      pcm.set(part, offset)
      offset += part.length
    }
    this.parts = []
    this.size = 0
    this.port.postMessage({ type: 'chunk', pcm, level: rmsLevel(pcm) } satisfies WorkletMessage, [pcm.buffer])
  }
}

registerProcessor('pcm-recorder', PcmRecorder)
