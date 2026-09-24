import { Check, Plus } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { stagger } from '../../components/stagger'
import { buttonStyles, cardStyles, kickerStyles } from '../../components/styles'

const ROADMAP = [
  { sprint: 'Sprint 0', title: 'תשתית: כניסה, מסד נתונים, פריסה ו-PWA', done: true },
  { sprint: 'Sprint 1', title: 'ייבוא מצגת ומצב הצגה עם תסריט וטיימר', done: false },
  { sprint: 'Sprint 2', title: 'הקלטת חזרה מלאה ודוח ביצוע', done: false },
  { sprint: 'Sprint 3', title: 'סטודיו תסריט וקול אמריקאי לכל משפט', done: false },
  { sprint: 'Sprint 4', title: 'תרגול משפטים, משוב AI ומעקב התקדמות', done: false },
]

export function LecturesPage() {
  return (
    <>
      <PageHeader
        number="01"
        section="Script Studio"
        title="הרצאות"
        subtitle="כאן מתחילים: יוצרים הרצאה, מייבאים מצגת PowerPoint, כותבים תסריט ועוברים לחזרות."
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className={`${cardStyles} rise-in flex flex-col items-start p-6 md:p-8`} style={stagger(3)}>
          <ScriptSheetArt />
          <h2 className="mt-6 font-display text-2xl font-semibold">עוד אין הרצאות</h2>
          <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">
            בקרוב תוכל ליצור הרצאה, להעלות קובץ <span dir="ltr">.pptx</span> ולקבל את השקפים, הטקסט והערות הדובר
            כבסיס לתסריט.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button type="button" disabled className={buttonStyles.primary}>
              <Plus size={18} aria-hidden="true" />
              הרצאה חדשה
            </button>
            <span className={kickerStyles} dir="ltr" lang="en">
              Sprint 1
            </span>
          </div>
        </section>

        <section className={`${cardStyles} rise-in p-6 md:p-8`} style={stagger(4)}>
          <h2 className="font-display text-xl font-semibold">מה בדרך</h2>
          <ol className="mt-5 space-y-4">
            {ROADMAP.map((step) => (
              <li key={step.sprint} className="flex gap-3">
                <span
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                    step.done ? 'border-good bg-good text-card' : 'border-rule text-ink-faint'
                  }`}
                  aria-hidden="true"
                >
                  {step.done ? <Check size={14} strokeWidth={3} /> : null}
                </span>
                <div>
                  <p className={kickerStyles} dir="ltr" lang="en" style={{ textAlign: 'right' }}>
                    {step.sprint}
                  </p>
                  <p className={step.done ? 'text-ink' : 'text-ink-soft'}>{step.title}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  )
}

/** A script page with one scored line: the app's promise in a picture. */
function ScriptSheetArt() {
  return (
    <svg viewBox="0 0 240 132" className="h-auto w-56 max-w-full" aria-hidden="true">
      <rect x="1" y="1" width="238" height="130" rx="14" fill="var(--color-paper)" stroke="var(--color-rule)" />
      <g fill="var(--color-rule)">
        <rect x="24" y="24" width="150" height="8" rx="4" />
        <rect x="24" y="44" width="192" height="8" rx="4" />
        <rect x="24" y="96" width="120" height="8" rx="4" />
      </g>
      <g fill="var(--color-ink-faint)" opacity="0.55">
        <rect x="24" y="66" width="44" height="8" rx="4" />
        <rect x="74" y="66" width="30" height="8" rx="4" />
        <rect x="110" y="66" width="58" height="8" rx="4" />
        <rect x="174" y="66" width="42" height="8" rx="4" />
      </g>
      <g strokeWidth="3" strokeLinecap="round">
        <line x1="24" y1="82" x2="68" y2="82" stroke="var(--color-good)" />
        <line x1="74" y1="82" x2="104" y2="82" stroke="var(--color-good)" />
        <line x1="110" y1="82" x2="168" y2="82" stroke="var(--color-bad)" />
        <line x1="174" y1="82" x2="216" y2="82" stroke="var(--color-warn)" />
      </g>
    </svg>
  )
}
