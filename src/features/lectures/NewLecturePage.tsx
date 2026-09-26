import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BackLink } from '../../components/BackLink'
import { PageHeader } from '../../components/PageHeader'
import { stagger } from '../../components/stagger'
import { cardStyles } from '../../components/styles'
import { useCreateLecture } from './api'
import { LectureForm } from './LectureForm'
import { toFormValues } from './lectureFields'

export function NewLecturePage() {
  const navigate = useNavigate()
  const create = useCreateLecture()
  const [values, setValues] = useState(() => toFormValues())

  return (
    <>
      <BackLink to="/" label="הרצאות" />
      <PageHeader number="01" section="New lecture" title="הרצאה חדשה" />
      <section className={`${cardStyles} rise-in max-w-2xl p-6 md:p-8`} style={stagger(3)}>
        <LectureForm
          values={values}
          onChange={setValues}
          onSubmit={(fields) =>
            create.mutate(fields, { onSuccess: (lecture) => void navigate(`/lectures/${lecture.id}`, { replace: true }) })
          }
          submitLabel="צור הרצאה"
          submitIcon={<Plus size={18} aria-hidden="true" />}
          busy={create.isPending}
          busyLabel="יוצר…"
          error={create.isError ? 'לא הצלחתי ליצור את ההרצאה. נסה שוב.' : null}
          onCancel={() => void navigate('/')}
        />
      </section>
    </>
  )
}
