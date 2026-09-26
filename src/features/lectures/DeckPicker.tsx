import { FileText, LoaderCircle, RefreshCw, Upload, X } from 'lucide-react'
import { useId, useRef, useState, type DragEvent } from 'react'
import { Alert } from '../../components/Alert'
import { buttonStyles } from '../../components/styles'
import type { ParsedDeck } from '../../lib/pptx'
import { MAX_UPLOAD_BYTES } from './importPayload'

export type PickedDeck = { file: File; deck: ParsedDeck }

type DeckPickerProps = {
  value: PickedDeck | null
  onChange: (picked: PickedDeck | null) => void
  disabled?: boolean
}

/** Picks a .pptx and reads it on the device (nothing is uploaded until the lecture is saved). */
export function DeckPicker({ value, onChange, disabled = false }: DeckPickerProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  async function read(file: File) {
    setError(null)
    if (!/\.pptx$/i.test(file.name)) {
      setError('צריך קובץ PowerPoint בסיומת .pptx.')
      return
    }
    setParsing(true)
    try {
      const { parsePptx, PptxError } = await import('../../lib/pptx')
      try {
        const deck = await parsePptx(file)
        if (deck.slides.length === 0) setError('לא מצאתי שקפים גלויים בקובץ.')
        else onChange({ file, deck })
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
    const file = event.dataTransfer.files[0]
    if (file && !disabled) void read(file)
  }

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
      className="sr-only"
      disabled={disabled || parsing}
      onChange={(e) => {
        const file = e.target.files?.[0]
        if (file) void read(file)
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
        <span className="font-medium">{parsing ? 'קורא את המצגת…' : 'בחר קובץ PowerPoint'}</span>
        <span className="text-sm text-ink-soft">
          קובץ <span dir="ltr">.pptx</span>. הטקסט והערות הדובר נקראים במכשיר שלך.
        </span>
      </label>
      {error ? (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}
    </div>
  )
}
