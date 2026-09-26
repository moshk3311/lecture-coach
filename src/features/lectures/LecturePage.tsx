import { LoaderCircle, Pencil, Presentation, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Alert } from '../../components/Alert'
import { BackLink } from '../../components/BackLink'
import { En } from '../../components/En'
import { stagger } from '../../components/stagger'
import { buttonStyles, cardStyles, kickerStyles } from '../../components/styles'
import { useDeleteLecture, useLectureDeck, useUpdateLecture, type LectureDeck } from './api'
import { LectureForm } from './LectureForm'
import { toFormValues } from './lectureFields'

export function LecturePage() {
  const { id = '' } = useParams()
  const { data: deck, isPending, isError } = useLectureDeck(id)

  if (isPending) {
    return (
      <p className="flex items-center gap-2 text-ink-soft">
        <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
        טוען הרצאה…
      </p>
    )
  }
  if (isError || !deck) {
    return (
      <div className="space-y-4">
        <BackLink to="/" label="הרצאות" />
        <Alert>{isError ? 'לא הצלחתי לטעון את ההרצאה. בדוק את החיבור ורענן את הדף.' : 'ההרצאה לא נמצאה.'}</Alert>
      </div>
    )
  }
  return <LectureView deck={deck} />
}

function LectureView({ deck }: { deck: LectureDeck }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view')
  const hasSlides = deck.slides.length > 0

  return (
    <>
      <BackLink to="/" label="הרצאות" />
      <header className="mt-2 mb-8 md:mb-10">
        <p className={`${kickerStyles} rise-in`}>
          <span dir="ltr" lang="en">
            01 · Lecture
          </span>
        </p>
        <h1
          dir="auto"
          className="rise-in mt-2 text-right font-display text-[34px] leading-[1.1] font-semibold md:text-[46px]"
          style={stagger(1)}
        >
          {deck.title}
        </h1>
        <p className="rise-in mt-3 flex flex-wrap gap-x-4 gap-y-1 text-ink-soft" style={stagger(2)}>
          <span>{hasSlides ? `${deck.slides.length} שקפים` : 'בלי שקפים עדיין'}</span>
          {deck.target_minutes ? <span>יעד: {deck.target_minutes} דקות</span> : <span>בלי משך יעד</span>}
          {deck.audience ? (
            <span>
              קהל: <span dir="auto">{deck.audience}</span>
            </span>
          ) : null}
        </p>

        {mode === 'view' ? (
          <div className="rise-in mt-6 flex flex-wrap items-center gap-3" style={stagger(3)}>
            {hasSlides ? (
              <Link to={`/present/${deck.id}`} className={buttonStyles.primary}>
                <Presentation size={18} aria-hidden="true" />
                התחל חזרה
              </Link>
            ) : (
              <button type="button" disabled className={buttonStyles.primary}>
                <Presentation size={18} aria-hidden="true" />
                התחל חזרה
              </button>
            )}
            <button type="button" onClick={() => setMode('edit')} className={buttonStyles.secondary}>
              <Pencil size={16} aria-hidden="true" />
              עריכה
            </button>
            <button type="button" onClick={() => setMode('delete')} className={`${buttonStyles.ghost} hover:text-bad`}>
              <Trash2 size={16} aria-hidden="true" />
              מחיקה
            </button>
          </div>
        ) : null}
        <div className="mt-6 h-px bg-rule" />
      </header>

      {mode === 'edit' ? <EditLecture deck={deck} onDone={() => setMode('view')} /> : null}
      {mode === 'delete' ? <DeleteLecture deck={deck} onCancel={() => setMode('view')} /> : null}

      <SlideList deck={deck} />
    </>
  )
}

function EditLecture({ deck, onDone }: { deck: LectureDeck; onDone: () => void }) {
  const update = useUpdateLecture()
  const [values, setValues] = useState(() => toFormValues(deck))

  return (
    <section className={`${cardStyles} rise-in mb-8 max-w-2xl p-6 md:p-8`}>
      <h2 className="mb-5 font-display text-xl font-semibold">עריכת פרטי ההרצאה</h2>
      <LectureForm
        values={values}
        onChange={setValues}
        onSubmit={(patch) => update.mutate({ id: deck.id, patch }, { onSuccess: onDone })}
        submitLabel="שמור"
        submitIcon={<Save size={18} aria-hidden="true" />}
        busy={update.isPending}
        busyLabel="שומר…"
        error={update.isError ? 'השמירה נכשלה. נסה שוב.' : null}
        onCancel={onDone}
      />
    </section>
  )
}

function DeleteLecture({ deck, onCancel }: { deck: LectureDeck; onCancel: () => void }) {
  const navigate = useNavigate()
  const remove = useDeleteLecture()

  return (
    <section role="alertdialog" aria-labelledby="delete-title" className={`${cardStyles} rise-in mb-8 max-w-2xl border-bad/30 p-6 md:p-8`}>
      <h2 id="delete-title" className="font-display text-xl font-semibold">
        למחוק את ההרצאה?
      </h2>
      <p className="mt-2 leading-relaxed text-ink-soft">
        יימחקו גם השקפים, התסריט והתמונות. אי אפשר לבטל את זה.
      </p>
      {remove.isError ? (
        <div className="mt-4">
          <Alert>המחיקה נכשלה. נסה שוב.</Alert>
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() => remove.mutate(deck, { onSuccess: () => void navigate('/', { replace: true }) })}
          className={buttonStyles.danger}
        >
          {remove.isPending ? (
            <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 size={18} aria-hidden="true" />
          )}
          מחק לצמיתות
        </button>
        <button type="button" onClick={onCancel} disabled={remove.isPending} className={buttonStyles.ghost}>
          ביטול
        </button>
      </div>
    </section>
  )
}

function SlideList({ deck }: { deck: LectureDeck }) {
  if (deck.slides.length === 0) {
    return (
      <section className={`${cardStyles} rise-in p-6 md:p-8`} style={stagger(4)}>
        <h2 className="font-display text-xl font-semibold">שקפים</h2>
        <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">להרצאה הזו עוד אין שקפים.</p>
      </section>
    )
  }

  return (
    <section className="rise-in" style={stagger(4)}>
      <h2 className="mb-4 font-display text-xl font-semibold">שקפים</h2>
      <ol className="grid grid-cols-1 gap-3">
        {deck.slides.map((slide) => (
          <li key={slide.id} className={`${cardStyles} flex gap-4 p-4 md:p-5`}>
            <span className="w-7 shrink-0 pt-0.5 text-center font-mono text-sm text-ink-faint">{slide.position}</span>
            <div className="min-w-0 flex-1">
              <En as="h3" className="block truncate font-medium">
                {slide.title || 'Untitled slide'}
              </En>
              <En as="p" className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-soft">
                {slide.sentences.map((s) => s.text).join(' ') || '—'}
              </En>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
