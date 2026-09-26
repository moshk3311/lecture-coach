import { FileImage, X } from 'lucide-react'
import { useId } from 'react'
import { buttonStyles } from '../../components/styles'

type PdfPickerProps = {
  value: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
  label?: string
}

/** A PDF export of the deck, used to draw the slides. */
export function PdfPicker({ value, onChange, disabled = false, label = 'בחר PDF' }: PdfPickerProps) {
  const inputId = useId()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        id={inputId}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      <label
        htmlFor={inputId}
        className={`${buttonStyles.secondary} h-10 cursor-pointer text-sm ${disabled ? 'pointer-events-none opacity-45' : ''}`}
      >
        <FileImage size={16} aria-hidden="true" />
        {value ? 'PDF אחר' : label}
      </label>
      {value ? (
        <span className="flex min-w-0 items-center gap-1 text-sm text-ink-soft">
          <span dir="ltr" className="truncate">
            {value.name}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-ink/5"
            aria-label="הסר PDF"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </span>
      ) : null}
    </div>
  )
}
