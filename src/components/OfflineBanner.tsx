import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../lib/useOnlineStatus'

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div role="status" className="flex items-center gap-2 border-b border-warn/30 bg-warn-soft px-4 py-2 text-sm text-warn">
      <WifiOff size={16} aria-hidden="true" />
      <span>אין חיבור לאינטרנט. אפשר לעיין, אבל הקלטה ושמירה דורשות רשת.</span>
    </div>
  )
}
