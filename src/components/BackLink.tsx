import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

/** "Back" in an RTL UI points right. */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="-ms-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-soft transition hover:bg-ink/5 hover:text-ink"
    >
      <ArrowRight size={16} aria-hidden="true" />
      {label}
    </Link>
  )
}
