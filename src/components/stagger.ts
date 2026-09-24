import type { CSSProperties } from 'react'

/** Delay index for the `rise-in` entrance animation (each step adds 70 ms). */
export function stagger(index: number): CSSProperties {
  return { '--i': index } as CSSProperties
}
