import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-bad/25 bg-bad-soft px-3 py-2.5 text-sm text-bad">
      <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
