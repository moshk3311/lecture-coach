import { LoaderCircle, Presentation } from 'lucide-react'
import { Link } from 'react-router'
import { Alert } from '../../components/Alert'
import { PageHeader } from '../../components/PageHeader'
import { stagger } from '../../components/stagger'
import { buttonStyles, cardStyles } from '../../components/styles'
import { useLectures } from '../lectures/api'

export function PresentPage() {
  const { data: lectures, isPending, isError } = useLectures()
  const ready = lectures?.filter((l) => l.slideCount > 0) ?? []

  return (
    <>
      <PageHeader
        number="03"
        section="Presenter View"
        title="הצגה"
        subtitle="חזרה על ההרצאה כולה: השקף משמאל, התסריט מימין, וטיימר שמראה אם אתה בזמן."
      />
      {isPending ? (
        <p className="flex items-center gap-2 text-ink-soft">
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          טוען הרצאות…
        </p>
      ) : isError ? (
        <Alert>לא הצלחתי לטעון את ההרצאות. בדוק את החיבור ורענן את הדף.</Alert>
      ) : ready.length === 0 ? (
        <section className={`${cardStyles} rise-in p-6 md:p-8`} style={stagger(3)}>
          <h2 className="font-display text-xl font-semibold">אין עדיין הרצאה עם שקפים</h2>
          <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">
            צור הרצאה וייבא אליה מצגת, ואז אפשר לעשות כאן חזרה מלאה.
          </p>
          <Link to="/lectures/new" className={`${buttonStyles.primary} mt-5`}>
            הרצאה חדשה
          </Link>
        </section>
      ) : (
        <ul className="rise-in grid grid-cols-1 gap-3" style={stagger(3)}>
          {ready.map((lecture) => (
            <li key={lecture.id} className={`${cardStyles} flex flex-wrap items-center gap-4 p-5 md:p-6`}>
              <div className="min-w-0 flex-1">
                <h2 dir="auto" className="truncate text-right font-display text-xl font-semibold">
                  {lecture.title}
                </h2>
                <p className="mt-1.5 text-sm text-ink-soft">
                  {lecture.slideCount} שקפים{lecture.target_minutes ? ` · ${lecture.target_minutes} דק׳` : ''}
                </p>
              </div>
              <Link to={`/present/${lecture.id}`} className={buttonStyles.primary}>
                <Presentation size={18} aria-hidden="true" />
                התחל חזרה
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
