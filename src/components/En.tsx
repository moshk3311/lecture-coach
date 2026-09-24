import type { ElementType, ReactNode } from 'react'

type EnProps = {
  children: ReactNode
  /** Element to render; inline <span> by default. */
  as?: ElementType
  className?: string
}

/** Wraps English learning content inside the Hebrew RTL UI (dir="ltr" lang="en"). */
export function En({ children, as: Tag = 'span', className }: EnProps) {
  return (
    <Tag dir="ltr" lang="en" className={className}>
      {children}
    </Tag>
  )
}
