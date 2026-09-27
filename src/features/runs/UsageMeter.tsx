import { cardStyles } from '../../components/styles'
import { useMonthUsage } from './api'
import { quotaState } from './quota'

const BAR = { ok: 'bg-good', warn: 'bg-warn', blocked: 'bg-bad' } as const

/** Azure audio minutes this month against the cap (ARCHITECTURE §5.6 usage meter). */
export function UsageMeter() {
  const { data, isError } = useMonthUsage()
  const minutes = data?.minutes ?? 0
  const cap = data?.cap ?? 300
  const state = quotaState(minutes, cap)

  return (
    <section className={`${cardStyles} p-6`}>
      <h2 className="font-display text-xl font-semibold">שימוש ב-Azure החודש</h2>
      <p className="mt-3 text-[15px]">
        <span dir="ltr" className="font-mono text-2xl">
          {Math.round(minutes)}
        </span>{' '}
        מתוך {cap} דקות
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-rule" role="meter" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={minutes} aria-label="דקות Azure החודש">
        <div className={`h-full rounded-full ${BAR[state]}`} style={{ width: `${Math.min(100, (minutes / Math.max(cap, 1)) * 100)}%` }} />
      </div>
      <p className="mt-3 text-sm text-ink-soft">
        {isError
          ? 'לא הצלחתי לטעון את השימוש.'
          : state === 'blocked'
            ? 'המכסה כמעט נגמרה: הקלטות חדשות חסומות עד החודש הבא.'
            : state === 'warn'
              ? 'נוצלו יותר מ-80% מהמכסה.'
              : 'הקלטות נחסמות ב-98% מהמכסה, כדי ש-Azure לא יפסיק באמצע.'}
      </p>
    </section>
  )
}
