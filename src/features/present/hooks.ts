import { useCallback, useEffect, useRef, useState } from 'react'

export type Stopwatch = {
  elapsedMs: number
  running: boolean
  started: boolean
  toggle: () => void
  reset: () => void
  /** From zero, running (a take starts the clock). */
  restart: () => void
  pause: () => void
}

/** Total rehearsal time; survives pauses, ticks four times a second while running. */
export function useStopwatch(): Stopwatch {
  const [running, setRunning] = useState(false)
  const [accumulated, setAccumulated] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(performance.now()), 250)
    return () => window.clearInterval(id)
  }, [running])

  const toggle = useCallback(() => {
    const t = performance.now()
    setNow(t)
    if (running && startedAt !== null) {
      setAccumulated((a) => a + (t - startedAt))
      setStartedAt(null)
      setRunning(false)
    } else {
      setStartedAt(t)
      setRunning(true)
    }
  }, [running, startedAt])

  const reset = useCallback(() => {
    setRunning(false)
    setAccumulated(0)
    setStartedAt(null)
  }, [])

  const restart = useCallback(() => {
    const t = performance.now()
    setNow(t)
    setAccumulated(0)
    setStartedAt(t)
    setRunning(true)
  }, [])

  const pause = useCallback(() => {
    if (!running || startedAt === null) return
    const t = performance.now()
    setNow(t)
    setAccumulated((a) => a + (t - startedAt))
    setStartedAt(null)
    setRunning(false)
  }, [running, startedAt])

  const elapsedMs = accumulated + (running && startedAt !== null ? Math.max(0, now - startedAt) : 0)
  return { elapsedMs, running, started: running || accumulated > 0, toggle, reset, restart, pause }
}

/** The current time, refreshed every `intervalMs`. */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/** Keeps the screen on while rehearsing (phones dim after a few seconds without touches). */
export function useWakeLock(): void {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) void lock.release()
      } catch {
        // Denied (low battery, no user gesture yet): the screen just follows its usual timeout.
      }
    }
    void acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', acquire)
      void lock?.release()
    }
  }, [])
}

/** A value that is true for `ms` after each call to `trigger`. */
export function useFlash(ms: number): [boolean, () => void] {
  const [on, setOn] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const trigger = useCallback(() => {
    setOn(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOn(false), ms)
  }, [ms])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return [on, trigger]
}
