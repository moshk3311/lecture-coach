import { Languages, Pencil } from 'lucide-react'
import { useState } from 'react'
import { buttonStyles } from '../../components/styles'
import { AmericanizePanel } from './AmericanizePanel'
import type { SlideWithSentences } from './api'
import { hasScript } from './draft'
import { DraftPanel } from './SlideDraft'

/** A slide's AI tools on the lecture page (§5.1): the pencil, and "Americanize" once there is a script. One is open at a time. */
export function SlideTools({ lectureId, slide }: { lectureId: string; slide: SlideWithSentences }) {
  const [open, setOpen] = useState<'draft' | 'americanize' | null>(null)
  const close = () => setOpen(null)
  if (open === 'draft') return <DraftPanel lectureId={lectureId} slide={slide} onClose={close} />
  if (open === 'americanize') return <AmericanizePanel lectureId={lectureId} slide={slide} onClose={close} />
  return (
    <div className="-ms-3 flex flex-wrap gap-1">
      <button type="button" onClick={() => setOpen('draft')} className={`${buttonStyles.ghost} h-9 text-sm`}>
        <Pencil size={15} aria-hidden="true" />
        הצע מלל
      </button>
      {hasScript(slide) ? (
        <button type="button" onClick={() => setOpen('americanize')} className={`${buttonStyles.ghost} h-9 text-sm`}>
          <Languages size={15} aria-hidden="true" />
          תקן לאמריקאית
        </button>
      ) : null}
    </div>
  )
}
