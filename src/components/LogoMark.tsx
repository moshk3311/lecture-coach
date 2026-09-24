/** The app mark: a speech waveform on royal ink. Mirrors public/logo.svg. */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <rect width="512" height="512" rx="120" fill="var(--color-accent)" />
      <g fill="var(--color-paper)">
        <rect x="118" y="200" width="36" height="112" rx="18" />
        <rect x="178" y="144" width="36" height="224" rx="18" />
        <rect x="238" y="104" width="36" height="304" rx="18" />
        <rect x="298" y="164" width="36" height="184" rx="18" />
        <rect x="358" y="208" width="36" height="96" rx="18" />
      </g>
    </svg>
  )
}
