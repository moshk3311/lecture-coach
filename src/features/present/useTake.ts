import { useCallback, useEffect, useRef, useState } from 'react'
import { RecorderError, TakeRecorder, type Recording } from '../../audio/recorder'
import type { SlideMark } from '../../lib/metrics'
import { MAX_TAKE_SECONDS } from '../runs/api'

export type FinishedTake = { recording: Recording; marks: SlideMark[]; stoppedAtLimit: boolean }

export type Take = {
  phase: 'idle' | 'starting' | 'recording' | 'stopping'
  /** Microphone level 0..1 while recording. */
  level: number
  error: string | null
  finished: FinishedTake | null
  /** Call from the tap or key handler itself (iOS needs the gesture to open the microphone). */
  start: (position: number) => void
  markSlide: (position: number) => void
  stop: () => void
  discard: () => void
}

/**
 * A full-run take (ARCHITECTURE §5.7): records the microphone and timestamps every slide change
 * on the audio clock, so slide times line up with the recording.
 */
export function useTake(): Take {
  const [phase, setPhase] = useState<Take['phase']>('idle')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [finished, setFinished] = useState<FinishedTake | null>(null)
  const recorder = useRef<TakeRecorder | null>(null)
  const marks = useRef<SlideMark[]>([])

  const start = useCallback((position: number) => {
    setError(null)
    setFinished(null)
    setPhase('starting')
    marks.current = [{ position, atSec: 0 }]
    TakeRecorder.start(setLevel).then(
      (r) => {
        recorder.current = r
        setPhase('recording')
      },
      (err: unknown) => {
        setPhase('idle')
        setError(err instanceof RecorderError ? err.message : 'לא הצלחתי להתחיל הקלטה.')
      },
    )
  }, [])

  const markSlide = useCallback((position: number) => {
    const r = recorder.current
    if (!r || marks.current.at(-1)?.position === position) return
    marks.current.push({ position, atSec: r.durationSec })
  }, [])

  const finish = useCallback((atLimit: boolean) => {
    const r = recorder.current
    if (!r) return
    recorder.current = null
    setPhase('stopping')
    void r.stop().then(
      (recording) => {
        setFinished({ recording, marks: marks.current, stoppedAtLimit: atLimit })
        setPhase('idle')
        setLevel(0)
      },
      () => {
        setPhase('idle')
        setError('ההקלטה נעצרה עם שגיאה.')
      },
    )
  }, [])

  // The upload limit caps a take's length; stop cleanly just before it.
  useEffect(() => {
    if (phase !== 'recording') return
    const id = window.setInterval(() => {
      if ((recorder.current?.durationSec ?? 0) >= MAX_TAKE_SECONDS) finish(true)
    }, 1000)
    return () => window.clearInterval(id)
  }, [phase, finish])

  // Leaving the page mid-take releases the microphone.
  useEffect(() => () => void recorder.current?.stop(), [])

  return {
    phase,
    level,
    error,
    finished,
    start,
    markSlide,
    stop: useCallback(() => finish(false), [finish]),
    discard: useCallback(() => setFinished(null), []),
  }
}
