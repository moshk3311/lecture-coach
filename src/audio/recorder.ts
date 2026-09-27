// Records the microphone as 16 kHz mono PCM16 (ARCHITECTURE §5.3). The AudioContext and the
// microphone must be started from a tap or key handler: iOS only allows audio after a user gesture.
import { TARGET_RATE } from './resample'
import type { WorkletMessage } from './pcmWorklet'
import workletUrl from './pcmWorklet.ts?worker&url'
import { concatPcm } from './wav'

/** A microphone failure with a Hebrew message the UI can show as-is. */
export class RecorderError extends Error {
  override name = 'RecorderError'
}

export type Recording = { pcm: Int16Array; sampleRate: number; durationSec: number }

export class TakeRecorder {
  private chunks: Int16Array[] = []
  private samples = 0
  private flushed: (() => void) | null = null
  private readonly context: AudioContext
  private readonly stream: MediaStream
  private readonly node: AudioWorkletNode

  private constructor(context: AudioContext, stream: MediaStream, node: AudioWorkletNode, onLevel: (level: number) => void) {
    this.context = context
    this.stream = stream
    this.node = node
    node.port.onmessage = (event: MessageEvent<WorkletMessage>) => {
      const message = event.data
      if (message.type === 'chunk') {
        this.chunks.push(message.pcm)
        this.samples += message.pcm.length
        onLevel(message.level)
      } else {
        this.flushed?.()
      }
    }
  }

  /** Call from the gesture handler itself (before any other await). */
  static async start(onLevel: (level: number) => void = () => {}): Promise<TakeRecorder> {
    if (!navigator.mediaDevices?.getUserMedia) throw new RecorderError('הדפדפן הזה לא מאפשר הקלטה. נסה Chrome או Safari עדכניים.')
    // Created before any await, while the user gesture still counts (iOS).
    const context = new AudioContext()
    void context.resume()
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
    } catch (err) {
      void context.close()
      throw new RecorderError(microphoneMessage(err))
    }
    try {
      await context.audioWorklet.addModule(workletUrl)
      const source = context.createMediaStreamSource(stream)
      const node = new AudioWorkletNode(context, 'pcm-recorder', { numberOfInputs: 1, numberOfOutputs: 1 })
      // Safari only runs nodes that lead to the speakers; the gain keeps them silent.
      const mute = context.createGain()
      mute.gain.value = 0
      source.connect(node).connect(mute).connect(context.destination)
      return new TakeRecorder(context, stream, node, onLevel)
    } catch {
      stream.getTracks().forEach((track) => track.stop())
      void context.close()
      throw new RecorderError('לא הצלחתי להפעיל את ההקלטה. רענן את הדף ונסה שוב.')
    }
  }

  get durationSec(): number {
    return this.samples / TARGET_RATE
  }

  /** Stops the microphone and returns everything recorded, including the last partial chunk. */
  async stop(): Promise<Recording> {
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 1000)
      this.flushed = () => {
        window.clearTimeout(timeout)
        resolve()
      }
      this.node.port.postMessage('flush')
    })
    this.stream.getTracks().forEach((track) => track.stop())
    this.node.disconnect()
    await this.context.close()
    const pcm = concatPcm(this.chunks)
    return { pcm, sampleRate: TARGET_RATE, durationSec: pcm.length / TARGET_RATE }
  }
}

function microphoneMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'אין הרשאה למיקרופון. אפשר גישה למיקרופון בהגדרות הדפדפן ונסה שוב.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'לא נמצא מיקרופון במכשיר.'
  if (name === 'NotReadableError') return 'המיקרופון תפוס על ידי אפליקציה אחרת.'
  return 'לא הצלחתי לפתוח את המיקרופון.'
}
