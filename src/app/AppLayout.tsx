import { LogOut } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { OfflineBanner } from '../components/OfflineBanner'
import { buttonStyles } from '../components/styles'
import { Wordmark } from '../components/Wordmark'
import { useAuth } from '../features/auth/useAuth'
import { NAV_ITEMS } from './nav'

/** RTL shell: sidebar on the right (desktop), bottom tab bar (mobile). */
export function AppLayout() {
  return (
    <div className="min-h-dvh md:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <OfflineBanner />
        <main className="mx-auto w-full max-w-5xl px-4 pt-7 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-10 md:pt-12 md:pb-16">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}

function Sidebar() {
  const { session, signOut } = useAuth()

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-rule bg-card/50 px-5 py-8 md:flex">
      <Wordmark />

      <nav className="mt-12 flex flex-col gap-1" aria-label="ניווט ראשי">
        {NAV_ITEMS.map(({ to, label, number, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className="group flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] text-ink-soft transition hover:bg-ink/5 hover:text-ink aria-[current=page]:bg-accent-soft aria-[current=page]:font-medium aria-[current=page]:text-accent"
          >
            <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
            <span className="flex-1">{label}</span>
            <span className="font-mono text-[11px] text-ink-faint group-aria-[current=page]:text-accent/70">
              {number}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-rule pt-5">
        <p className="truncate text-right text-sm text-ink-soft" dir="ltr" title={session?.user.email}>
          {session?.user.email}
        </p>
        <button type="button" onClick={() => void signOut()} className={`${buttonStyles.ghost} -ms-3 mt-2 h-9`}>
          <LogOut size={16} aria-hidden="true" />
          יציאה
        </button>
      </div>
    </aside>
  )
}

function BottomNav() {
  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className="relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] text-ink-faint transition aria-[current=page]:font-medium aria-[current=page]:text-accent aria-[current=page]:before:absolute aria-[current=page]:before:top-0 aria-[current=page]:before:h-0.5 aria-[current=page]:before:w-8 aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-accent"
            >
              <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
