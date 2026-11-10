import { NotebookPen, Settings, type LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  /** Program-booklet numbering shown in the sidebar. */
  number: string
  icon: LucideIcon
  /** Other path prefixes that belong to this section (e.g. /lectures/:id under "Lectures"). */
  prefixes?: string[]
}

/** True when `pathname` is this item's page or one of its sub-pages. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.to) return true
  const prefixes = item.to === '/' ? (item.prefixes ?? []) : [item.to, ...(item.prefixes ?? [])]
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'הרצאות', number: '01', icon: NotebookPen, prefixes: ['/lectures'] },
  { to: '/settings', label: 'הגדרות', number: '02', icon: Settings },
]
