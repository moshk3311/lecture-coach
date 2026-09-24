import { ChartLine, Mic, NotebookPen, Presentation, Settings, type LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  /** Program-booklet numbering shown in the sidebar. */
  number: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'הרצאות', number: '01', icon: NotebookPen },
  { to: '/practice', label: 'תרגול', number: '02', icon: Mic },
  { to: '/present', label: 'הצגה', number: '03', icon: Presentation },
  { to: '/progress', label: 'התקדמות', number: '04', icon: ChartLine },
  { to: '/settings', label: 'הגדרות', number: '05', icon: Settings },
]
