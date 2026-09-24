import { LogoMark } from '../components/LogoMark'

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="טוען">
      <LogoMark className="h-14 w-14 animate-pulse-live" />
    </div>
  )
}
