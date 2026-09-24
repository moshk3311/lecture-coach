import type { ReactNode } from 'react'
import { stagger } from './stagger'
import { kickerStyles } from './styles'

type PageHeaderProps = {
  /** Section number, like a program booklet: "01". */
  number: string
  /** English section name shown in the kicker. */
  section: string
  title: string
  subtitle?: ReactNode
}

export function PageHeader({ number, section, title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-8 md:mb-10">
      <p className={`${kickerStyles} rise-in`}>
        <span dir="ltr" lang="en">
          {number} · {section}
        </span>
      </p>
      <h1
        className="rise-in mt-2 font-display text-[34px] leading-[1.1] font-semibold md:text-[46px]"
        style={stagger(1)}
      >
        {title}
      </h1>
      {subtitle ? (
        <p className="rise-in mt-3 max-w-prose text-[16px] leading-relaxed text-ink-soft" style={stagger(2)}>
          {subtitle}
        </p>
      ) : null}
      <div className="mt-6 h-px bg-rule" />
    </header>
  )
}
