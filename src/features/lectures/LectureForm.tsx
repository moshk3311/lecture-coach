import { LoaderCircle } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Alert } from '../../components/Alert'
import { buttonStyles, inputStyles } from '../../components/styles'
import type { LectureFieldsInput } from './api'
import { toLectureFields, type LectureFormValues } from './lectureFields'

type LectureFormProps = {
  values: LectureFormValues
  onChange: (values: LectureFormValues) => void
  onSubmit: (fields: LectureFieldsInput) => void
  submitLabel: string
  submitIcon: ReactNode
  busy?: boolean
  busyLabel?: string
  error?: string | null
  onCancel?: () => void
  /** Extra fields rendered between the lecture fields and the buttons. */
  children?: ReactNode
}

export function LectureForm({
  values,
  onChange,
  onSubmit,
  submitLabel,
  submitIcon,
  busy = false,
  busyLabel,
  error,
  onCancel,
  children,
}: LectureFormProps) {
  const [validationError, setValidationError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const fields = toLectureFields(values)
    if ('error' in fields) {
      setValidationError(fields.error)
      return
    }
    setValidationError(null)
    onSubmit(fields)
  }

  const set = (key: keyof LectureFormValues) => (value: string) => onChange({ ...values, [key]: value })
  const shownError = validationError ?? error

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <label className="block">
        <span className="text-sm font-medium">כותרת</span>
        <input
          dir="auto"
          required
          maxLength={200}
          value={values.title}
          onChange={(e) => set('title')(e.target.value)}
          placeholder="למשל: How our fertilizer plant works"
          className={`${inputStyles} mt-1.5 placeholder-shown:[direction:rtl]`}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
        <label className="block">
          <span className="text-sm font-medium">
            קהל <span className="font-normal text-ink-faint">(לא חובה)</span>
          </span>
          <input
            dir="auto"
            maxLength={200}
            value={values.audience}
            onChange={(e) => set('audience')(e.target.value)}
            placeholder="למשל: יועצי מקנזי"
            className={`${inputStyles} mt-1.5 placeholder-shown:[direction:rtl]`}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">
            משך יעד <span className="font-normal text-ink-faint">(דקות)</span>
          </span>
          <input
            dir="ltr"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            value={values.minutes}
            onChange={(e) => set('minutes')(e.target.value.replace(/\D/g, ''))}
            placeholder="15"
            className={`${inputStyles} mt-1.5 text-center font-mono`}
          />
        </label>
      </div>

      {children}

      {shownError ? <Alert>{shownError}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" disabled={busy} className={buttonStyles.primary}>
          {busy ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : submitIcon}
          {busy && busyLabel ? busyLabel : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={busy} className={buttonStyles.ghost}>
            ביטול
          </button>
        ) : null}
      </div>
    </form>
  )
}
