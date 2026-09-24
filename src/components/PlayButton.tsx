import { Play, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { buttonStyles } from './styles'

type PlayButtonProps = { src: string; label?: string }

/** Plays one audio clip; a second tap stops it. */
export function PlayButton({ src, label = 'השמע' }: PlayButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const audio = new Audio(src)
    const stop = () => setPlaying(false)
    audio.addEventListener('ended', stop)
    audio.addEventListener('pause', stop)
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.removeEventListener('ended', stop)
      audio.removeEventListener('pause', stop)
      audioRef.current = null
    }
  }, [src])

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      audio.currentTime = 0
      return
    }
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }

  return (
    <button type="button" onClick={toggle} className={`${buttonStyles.secondary} h-9 px-3 text-sm`} aria-pressed={playing}>
      {playing ? <Square size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
      {playing ? 'עצור' : label}
    </button>
  )
}
