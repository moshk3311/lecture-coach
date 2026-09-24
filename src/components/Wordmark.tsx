import { LogoMark } from './LogoMark'

export function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <LogoMark className="h-10 w-10 shrink-0" />
      <div>
        <div className="font-display text-[22px] leading-none font-semibold">מאמן הרצאות</div>
        <div
          dir="ltr"
          lang="en"
          className="mt-1.5 text-right font-mono text-[10px] tracking-[0.24em] text-ink-faint uppercase"
        >
          Lecture Coach
        </div>
      </div>
    </div>
  )
}
