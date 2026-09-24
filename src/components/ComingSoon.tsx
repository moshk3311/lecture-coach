import { Sparkles } from 'lucide-react'
import type { CSSProperties } from 'react'
import { cardStyles, kickerStyles } from './styles'

type ComingSoonProps = {
  sprint: string
  title: string
  description: string
  items: string[]
  style?: CSSProperties
}

/** Placeholder for a screen that a later sprint fills in; says exactly what is coming. */
export function ComingSoon({ sprint, title, description, items, style }: ComingSoonProps) {
  return (
    <section className={`${cardStyles} rise-in p-6 md:p-8`} style={style}>
      <p className={`${kickerStyles} flex items-center gap-2 text-accent`}>
        <Sparkles size={14} aria-hidden="true" />
        <span dir="ltr" lang="en">
          {sprint}
        </span>
      </p>
      <h2 className="mt-3 font-display text-2xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">{description}</p>
      <ul className="mt-5 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-3 leading-relaxed">
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
