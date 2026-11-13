import { FileText, LoaderCircle, RefreshCw, Upload, X } from 'lucide-react'
import { useId, useRef, useState, type DragEvent } from 'react'
import { Alert } from '../../components/Alert'
import { buttonStyles } from '../../components/styles'
import type { ParsedDeck } from '../../lib/pptx'
import { splitDeckFiles } from './deckFiles'
import { MAX_UPLOAD_BYTES } from './importPayload'

/** The parsed deck, and its PDF export when it was picked together with it. */
export type PickedDeck = { file: File; deck: ParsedDeck; pdf?: File }

type DeckPickerProps = {
  value: PickedDeck | null
  onChange: (picked: PickedDeck | null) => void
  disabled?: boolean
  /** Also take the deck's PDF export, picked or dropped together with the .pptx. */
  acceptPdf?: boolean
}

const PPTX_ACCEPT = '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation'
const PDF_LATER = 'את ה-PDF מוסיפים אחרי הייבוא, בכרטיס "תמונות השקפים".'

/** Picks a .pptx (and optionally its PDF) and reads it on the device (nothing is uploaded until the lecture is saved). */
export function DeckPicker({ value, onChange, disabled = false, acceptPdf = false }: DeckPickerProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  // A PDF picked before its .pptx: kept until the .pptx comes.
  const [pendingPdf, setPendingPdf] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)

  async function read(files: File[]) {
    setError(null)
    setHint(null)
    const { pptx, pdf, rejected, extraPptx } = splitDeckFiles(files)
    if (extraPptx) {
      setError('בחר קובץ PowerPoint אחד.')
      return
    }
    if (rejected.length) {
      setError(acceptPdf ? 'צריך קובץ PowerPoint (.pptx) ואפשר גם PDF שלו.' : 'צריך קובץ PowerPoint בסיומת .pptx.')
      return
    }
    if (!pptx) {
      if (pdf && acceptPdf && value) {
        // The deck is already picked: this PDF goes with it.
        onChange({ ...value, pdf })
      } else if (pdf && acceptPdf) {
        setPendingPdf(pdf)
        setHint('קיבלתי את ה-PDF. עכשיו בחר גם את קובץ ה-PowerPoint.')
      } else if (pdf) {
        setHint(PDF_LATER)
      } else {
        setError('צריך קובץ PowerPoint בסיומת .pptx.')
      }
      return
    }
    const file = pptx
    const pairedPdf = acceptPdf ? (pdf ?? pendingPdf ?? undefined) : undefined
    if (pdf && !acceptPdf) setHint(PDF_LATER)
    setParsing(true)
    try {
      const { parsePptx, PptxError } = await import('../../lib/pptx')
      try {
        const deck = await parsePptx(file)
        if (deck.slides.length === 0) setError('לא מצאתי שקפים גלויים בקובץ.')
        else {
          setPendingPdf(null)
          onChange(pairedPdf ? { file, deck, pdf: pairedPdf } : { file, deck })
        }
      } catch (err) {
        setError(err instanceof PptxError ? err.message : 'לא הצלחתי לקרוא את הקובץ.')
      }
    } catch {
      setError('לא הצלחתי לטעון את קורא המצגות. בדוק את החיבור ונסה שוב.')
    } finally {
      setParsing(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    const files = [...event.dataTransfer.files]
    if (files.length && !disabled) void read(files)
  }

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      // .pptx stays first: e2e/import.js finds this input by accept^=".pptx".
      accept={acceptPdf ? `${PPTX_ACCEPT},.pdf,application/pdf` : PPTX_ACCEPT}
      multiple={acceptPdf}
      className="sr-only"
      disabled={disabled || parsing}
      onChange={(e) => {
        const files = [...(e.target.files ?? [])]
        if (files.length) void read(files)
      }}
    />
  )

  if (value) {
    const { file, deck } = value
    const withNotes = deck.slides.filter((s) => s.notes.trim()).length
    return (
      <div className="rounded-xl border border-rule bg-paper p-4">
        {input}
        <div className="flex items-start gap-3">
          <FileText size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-right font-medium" dir="ltr">
              {file.name}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {deck.slides.length} שקפים · {withNotes ? `${withNotes} עם הערות דובר` : 'בלי הערות דובר'}
              {deck.hiddenCount ? ` · ${deck.hiddenCount} מוסתרים לא ייובאו` : ''}
            </p>
            {withNotes === 0 ? (
              <p className="mt-1 text-sm text-ink-faint">בלי הערות דובר התסריט יתחיל ריק, ואפשר לכתוב אותו במצב מציג.</p>
            ) : null}
            {file.size > MAX_UPLOAD_BYTES ? (
              <p className="mt-1 text-sm text-warn">הקובץ גדול מ-50MB, לכן רק הטקסט שלו יישמר.</p>
            ) : null}
          </div>
        </div>
        {error ? (
          <div className="mt-3">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        {hint ? <p className="mt-3 text-sm text-ink-soft">{hint}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <label htmlFor={inputId} className={`${buttonStyles.ghost} h-9 cursor-pointer text-sm ${disabled ? 'pointer-events-none opacity-45' : ''}`}>
            <RefreshCw size={15} aria-hidden="true" />
            קובץ אחר
          </label>
          <button type="button" disabled={disabled} onClick={() => onChange(null)} className={`${buttonStyles.ghost} h-9 text-sm`}>
            <X size={15} aria-hidden="true" />
            הסר
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {input}
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${
          dragging ? 'border-accent bg-accent-soft' : 'border-rule bg-paper hover:border-ink-faint'
        } ${disabled || parsing ? 'pointer-events-none opacity-60' : ''}`}
      >
        {parsing ? (
          <LoaderCircle size={24} className="animate-spin text-accent" aria-hidden="true" />
        ) : (
          <Upload size={24} className="text-accent" aria-hidden="true" />
        )}
        <span className="font-medium">
          {parsing ? 'קורא את המצגת…' : acceptPdf ? 'בחר את קובץ ה-PowerPoint, ואם יש גם את ה-PDF שלו' : 'בחר קובץ PowerPoint'}
        </span>
        <span className="text-sm text-ink-soft">
          {acceptPdf ? (
            <>
              אפשר לבחור או לגרור את שני הקבצים יחד. הם נקראים במכשיר שלך.
            </>
          ) : (
            <>
              קובץ <span dir="ltr">.pptx</span>. הטקסט והערות הדובר נקראים במכשיר שלך.
            </>
          )}
        </span>
      </label>
      {error ? (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {hint ? <p className="mt-3 text-sm text-ink-soft">{hint}</p> : null}
    </div>
  )
}
