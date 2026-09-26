import { ChevronLeft, LoaderCircle, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Alert } from '../../components/Alert'
import { PageHeader } from '../../components/PageHeader'
import { stagger } from '../../components/stagger'
import { buttonStyles, cardStyles, kickerStyles } from '../../components/styles'
import { formatShortDate } from '../../lib/format'
import { useLectures, type LectureSummary } from './api'

export function LecturesPage() {
  const { data: lectures, isPending, isError } = useLectures()

  return (
    <>
      <PageHeader
        number="01"
        section="Script Studio"
        title="הרצאות"
        subtitle="כאן מתחילים: יוצרים הרצאה, מייבאים מצגת PowerPoint ועוברים לחזרות."
      />

      {isPending ? (
        <p className="flex items-center gap-2 text-ink-soft">
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          טוען הרצאות…
        </p>
      ) : isError ? (
        <Alert>לא הצלחתי לטעון את ההרצאות. בדוק את החיבור ורענן את הדף.</Alert>
      ) : lectures.length === 0 ? (
        <EmptyState />
      ) : (
        <LectureList lectures={lectures} />
      )}
    </>
  )
}

function LectureList({ lectures }: { lectures: LectureSummary[] }) {
  return (
    <div className="rise-in" style={stagger(3)}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-ink-soft">{lectures.length === 1 ? 'הרצאה אחת' : `${lectures.length} הרצאות`}</p>
        <Link to="/lectures/new" className={buttonStyles.primary}>
          <Plus size={18} aria-hidden="true" />
          הרצאה חדשה
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-3">
        {lectures.map((lecture) => (
          <li key={lecture.id}>
            <Link
              to={`/lectures/${lecture.id}`}
              className={`${cardStyles} group flex items-center gap-4 p-5 transition hover:border-ink-faint md:p-6`}
            >
              <div className="min-w-0 flex-1">
                <h2 dir="auto" className="truncate text-right font-display text-xl font-semibold">
                  {lecture.title}
                </h2>
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-soft">
                  <span>{lecture.slideCount ? `${lecture.slideCount} שקפים` : 'בלי שקפים עדיין'}</span>
                  {lecture.target_minutes ? <span>{lecture.target_minutes} דק׳</span> : null}
                  {lecture.audience ? (
                    <span className="min-w-0 truncate">
                      קהל: <span dir="auto">{lecture.audience}</span>
                    </span>
                  ) : null}
                </p>
              </div>
              <span className="hidden shrink-0 text-sm text-ink-faint sm:block">{formatShortDate(lecture.updated_at)}</span>
              <ChevronLeft size={20} className="shrink-0 text-ink-faint transition group-hover:-translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EmptyState() {
  return (
    <section className={`${cardStyles} rise-in flex flex-col items-start p-6 md:p-8`} style={stagger(3)}>
      <ScriptSheetArt />
      <h2 className="mt-6 font-display text-2xl font-semibold">עוד אין הרצאות</h2>
      <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">
        צור הרצאה והעלה קובץ <span dir="ltr">.pptx</span>. השקפים והערות הדובר יהפכו לבסיס של התסריט, ואז אפשר
        לעשות חזרה במצב מציג.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Link to="/lectures/new" className={buttonStyles.primary}>
          <Plus size={18} aria-hidden="true" />
          הרצאה חדשה
        </Link>
        <span className={kickerStyles} dir="ltr" lang="en">
          Step 1
        </span>
      </div>
    </section>
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
