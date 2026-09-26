import { Timer } from 'lucide-react'
import { useState } from 'react'
import { formatClock, parseClock } from '../../lib/format'
import type { SlideWindow } from '../present/plan'

type PlannedTimeProps = {
  window: SlideWindow | undefined
  /** The slide's manual planned_seconds, or null when it follows the script length. */
  manualSeconds: number | null
  onSave: (seconds: number | null) => void
}

/** A slide's planned time; click to set it by hand (m:ss), empty goes back to automatic. */
export function PlannedTime({ window, manualSeconds, onSave }: PlannedTimeProps) {
  const [draft, setDraft] = useState<string | null>(null)
  if (!window) return null
  const seconds = window.end - window.start

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => setDraft(manualSeconds ? formatClock(manualSeconds) : '')}
        title="זמן מתוכנן לשקף. לחץ כדי לקבוע ידנית."
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-ink-soft hover:bg-ink/5 hover:text-ink"
      >
        <Timer size={13} aria-hidden="true" />
        <span dir="ltr" className="font-mono">
          {formatClock(seconds)}
        </span>
        <span className="text-ink-faint">{window.manual ? '· ידני' : '· לפי התסריט'}</span>
      </button>
    )
  }

  const parsed = parseClock(draft)
  const invalid = parsed !== null && (Number.isNaN(parsed) || parsed < 1 || parsed > 3600)
  const commit = () => {
    if (invalid) return
    if (parsed !== manualSeconds) onSave(parsed)
    setDraft(null)
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <input
        dir="ltr"
        autoFocus
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setDraft(null)
        }}
        placeholder="auto"
        aria-label="זמן מתוכנן (דקות:שניות), ריק = אוטומטי"
        aria-invalid={invalid}
        className={`h-7 w-20 rounded-md border bg-card px-2 text-center font-mono text-xs focus:outline-none ${
          invalid ? 'border-bad text-bad' : 'border-accent'
        }`}
      />
      <span className="text-ink-faint">דקות:שניות · ריק = אוטומטי</span>
    </span>
  )
}
