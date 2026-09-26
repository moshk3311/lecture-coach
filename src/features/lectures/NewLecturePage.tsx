import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BackLink } from '../../components/BackLink'
import { PageHeader } from '../../components/PageHeader'
import { stagger } from '../../components/stagger'
import { cardStyles } from '../../components/styles'
import { useCreateLecture, useImportDeck, type LectureFieldsInput } from './api'
import { DeckPicker, type PickedDeck } from './DeckPicker'
import { LectureForm } from './LectureForm'
import { toFormValues } from './lectureFields'
import { suggestTitle } from './importPayload'

type Step = 'idle' | 'creating' | 'importing'

export function NewLecturePage() {
  const navigate = useNavigate()
  const create = useCreateLecture()
  const importDeck = useImportDeck()
  const [values, setValues] = useState(() => toFormValues())
  const [picked, setPicked] = useState<PickedDeck | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)

  function pick(next: PickedDeck | null) {
    setPicked(next)
    if (next && !values.title.trim()) setValues({ ...values, title: suggestTitle(next.file.name, next.deck) })
  }

  async function submit(fields: LectureFieldsInput) {
    setError(null)
    setStep('creating')
    let lecture
    try {
      lecture = await create.mutateAsync(fields)
    } catch {
      setStep('idle')
      setError('לא הצלחתי ליצור את ההרצאה. נסה שוב.')
      return
    }
    if (picked) {
      setStep('importing')
      try {
        await importDeck.mutateAsync({ lecture, file: picked.file, deck: picked.deck })
      } catch {
        // The lecture exists; its page offers the import again.
        void navigate(`/lectures/${lecture.id}`, { replace: true, state: { importFailed: true } })
        return
      }
    }
    void navigate(`/lectures/${lecture.id}`, { replace: true })
  }

  return (
    <>
      <BackLink to="/" label="הרצאות" />
      <PageHeader number="01" section="New lecture" title="הרצאה חדשה" />
      <section className={`${cardStyles} rise-in max-w-2xl p-6 md:p-8`} style={stagger(3)}>
        <LectureForm
          values={values}
          onChange={setValues}
          onSubmit={(fields) => void submit(fields)}
          submitLabel="צור הרצאה"
          submitIcon={<Plus size={18} aria-hidden="true" />}
          busy={step !== 'idle'}
          busyLabel={step === 'importing' ? 'מייבא שקפים…' : 'יוצר…'}
          error={error}
          onCancel={() => void navigate('/')}
          leading={
            <div>
              <p className="mb-1.5 text-sm font-medium">
                מצגת <span className="font-normal text-ink-faint">(אפשר גם אחר כך)</span>
              </p>
              <DeckPicker value={picked} onChange={pick} disabled={step !== 'idle'} />
            </div>
          }
        />
      </section>
    </>
  )
}
