import { FileUp, ImagePlus, LoaderCircle, Pencil, Presentation, Save, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Alert } from '../../components/Alert'
import { BackLink } from '../../components/BackLink'
import { En } from '../../components/En'
import { SlideFrame } from '../../components/SlideFrame'
import { stagger } from '../../components/stagger'
import { buttonStyles, cardStyles, kickerStyles } from '../../components/styles'
import { formatClock } from '../../lib/format'
import { countWords, joinScript } from '../../lib/script'
import { planWindows } from '../present/plan'
import {
  useDeleteLecture,
  useImportDeck,
  useLectureDeck,
  useRenderSlideImages,
  useSlideImageUrls,
  useUpdateLecture,
  useUpdateSlide,
  type LectureDeck,
} from './api'
import { DeckPicker, type PickedDeck } from './DeckPicker'
import { PdfPicker } from './PdfPicker'
import { PlannedTime } from './PlannedTime'
import { RunHistory } from '../runs/RunHistory'
import { SlideImagesError, type RenderProgress, type RenderResult } from './slideImages'
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

      {hasSlides ? <SlideImagesPanel deck={deck} /> : null}
      {hasSlides ? <RunHistory lectureId={deck.id} /> : null}
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
  if (deck.slides.length === 0) return <ImportPanel lecture={deck} />

  return <SlideRows deck={deck} />
}

function SlideRows({ deck }: { deck: LectureDeck }) {
  const { data: urls } = useSlideImageUrls(deck)
  const updateSlide = useUpdateSlide(deck.id)
  const windows = useMemo(
    () =>
      planWindows(
        deck.slides.map((s) => ({ words: countWords(joinScript(s.sentences)), plannedSeconds: s.planned_seconds })),
        deck.target_minutes ? deck.target_minutes * 60 : null,
      ),
    [deck.slides, deck.target_minutes],
  )
  const total = windows.at(-1)?.end ?? 0

  return (
    <section className="rise-in mt-8" style={stagger(5)}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-xl font-semibold">שקפים</h2>
        <p className="text-sm text-ink-soft">
          תכנון כולל{' '}
          <span dir="ltr" className="font-mono">
            {formatClock(total)}
          </span>
          {deck.target_minutes ? ` · יעד ${deck.target_minutes} דק׳` : ' · לפי 140 מילים לדקה'}
        </p>
      </div>
      <ol className="grid grid-cols-1 gap-3">
        {deck.slides.map((slide, index) => (
          <li key={slide.id} className={`${cardStyles} flex gap-3 p-3 sm:gap-4 sm:p-4`}>
            <span className="w-6 shrink-0 pt-0.5 text-center font-mono text-sm text-ink-faint">{slide.position}</span>
            <div className="min-w-0 flex-1">
              <En as="h3" className="block truncate font-medium">
                {slide.title || 'Untitled slide'}
              </En>
              <En as="p" className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-soft">
                {joinScript(slide.sentences) || '—'}
              </En>
              <div className="mt-1.5 -ms-1.5">
                <PlannedTime
                  window={windows[index]}
                  manualSeconds={slide.planned_seconds}
                  onSave={(seconds) => updateSlide.mutate({ id: slide.id, patch: { planned_seconds: seconds } })}
                />
              </div>
            </div>
            <SlideFrame
              imageUrl={slide.image_path ? urls?.get(slide.image_path) : null}
              title={slide.title}
              className="w-24 shrink-0 self-start sm:w-32"
            />
          </li>
        ))}
      </ol>
    </section>
  )
}

function SlideImagesPanel({ deck }: { deck: LectureDeck }) {
  const location = useLocation()
  const imagesFailed = (location.state as { imagesFailed?: boolean } | null)?.imagesFailed === true
  const render = useRenderSlideImages()
  const [pdf, setPdf] = useState<File | null>(null)
  const [progress, setProgress] = useState<RenderProgress | null>(null)
  const [result, setResult] = useState<RenderResult | null>(null)
  const withImages = deck.slides.filter((s) => s.image_path).length
  const [open, setOpen] = useState(withImages === 0)

  function run() {
    if (!pdf) return
    setResult(null)
    render.mutate(
      { lecture: deck, pdf, onProgress: setProgress },
      {
        onSuccess: (r) => {
          setResult(r)
          setPdf(null)
          setOpen(false)
        },
        onSettled: () => setProgress(null),
      },
    )
  }

  const failed = render.isError || (imagesFailed && render.isIdle)
  const errorText =
    render.error instanceof SlideImagesError ? render.error.message : 'יצירת תמונות השקפים נכשלה. נסה שוב.'

  return (
    <section className={`${cardStyles} rise-in mb-8 p-5 md:p-6`} style={stagger(4)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">תמונות השקפים</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {withImages === 0
              ? 'עוד אין תמונות. בינתיים מצב מציג מראה את כותרת השקף והטקסט שלו.'
              : `יש תמונות ל-${withImages} מתוך ${deck.slides.length} שקפים.`}
          </p>
        </div>
        {!open && !render.isPending ? (
          <button type="button" onClick={() => setOpen(true)} className={`${buttonStyles.secondary} h-10 text-sm`}>
            <ImagePlus size={16} aria-hidden="true" />
            {withImages ? 'עדכן מ-PDF' : 'הוסף מ-PDF'}
          </button>
        ) : null}
      </div>

      {open || render.isPending ? (
        <div className="mt-4 border-t border-rule pt-4">
          <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
            ייצא את המצגת ל-PDF (ב-PowerPoint: קובץ ← שמירה בשם ← PDF) והעלה אותו כאן. כל עמוד הופך לתמונה של השקף
            באותו מספר. ההמרה נעשית במכשיר שלך.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <PdfPicker value={pdf} onChange={setPdf} disabled={render.isPending} />
            <button type="button" disabled={!pdf || render.isPending} onClick={run} className={`${buttonStyles.primary} h-10 text-sm`}>
              {render.isPending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
              {render.isPending ? 'יוצר תמונות…' : 'צור תמונות'}
            </button>
            {withImages && !render.isPending ? (
              <button type="button" onClick={() => setOpen(false)} className={`${buttonStyles.ghost} h-10 text-sm`}>
                ביטול
              </button>
            ) : null}
          </div>
          {progress ? <ProgressBar progress={progress} /> : null}
        </div>
      ) : null}

      {failed ? (
        <div className="mt-4">
          <Alert>{errorText}</Alert>
        </div>
      ) : null}
      {result && result.pages !== result.slides ? (
        <p className="mt-3 text-sm text-warn">
          ב-PDF יש {result.pages} עמודים ובמצגת {result.slides} שקפים, אז התמונות הותאמו לפי הסדר. אם יש שקפים מוסתרים,
          ייצא PDF בלעדיהם.
        </p>
      ) : null}
    </section>
  )
}

function ProgressBar({ progress }: { progress: RenderProgress }) {
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  return (
    <div className="mt-4" role="status">
      <p className="text-sm text-ink-soft">
        מעבד שקף {Math.min(progress.done + 1, progress.total)} מתוך {progress.total}…
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rule">
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function ImportPanel({ lecture }: { lecture: LectureDeck }) {
  const location = useLocation()
  const importFailed = (location.state as { importFailed?: boolean } | null)?.importFailed === true
  const importDeck = useImportDeck()
  const [picked, setPicked] = useState<PickedDeck | null>(null)
  const failed = importDeck.isError || (importFailed && importDeck.isIdle)

  return (
    <section className={`${cardStyles} rise-in max-w-2xl p-6 md:p-8`} style={stagger(4)}>
      <h2 className="font-display text-xl font-semibold">ייבוא מצגת</h2>
      <p className="mt-2 mb-5 max-w-prose leading-relaxed text-ink-soft">
        להרצאה עוד אין שקפים. העלה את קובץ ה-PowerPoint: כל שקף יקבל כותרת, טקסט ותסריט ראשון מהערות הדובר.
      </p>
      <DeckPicker value={picked} onChange={setPicked} disabled={importDeck.isPending} />
      {failed ? (
        <div className="mt-4">
          <Alert>ייבוא השקפים נכשל. נסה שוב.</Alert>
        </div>
      ) : null}
      <button
        type="button"
        disabled={!picked || importDeck.isPending}
        onClick={() => picked && importDeck.mutate({ lecture, file: picked.file, deck: picked.deck })}
        className={`${buttonStyles.primary} mt-5`}
      >
        {importDeck.isPending ? (
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
        ) : (
          <FileUp size={18} aria-hidden="true" />
        )}
        {importDeck.isPending ? 'מייבא…' : 'ייבא שקפים'}
      </button>
    </section>
  )
}
