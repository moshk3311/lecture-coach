// Shared Tailwind class sets, so every screen speaks the same visual language.

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-lg px-5 h-11 text-[15px] font-medium transition ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-45'

export const buttonStyles = {
  primary: `${buttonBase} bg-accent text-on-accent shadow-[0_1px_0_rgb(0_0_0/0.12)] hover:brightness-110`,
  secondary: `${buttonBase} border border-rule bg-card text-ink hover:border-ink-faint`,
  ghost: `${buttonBase} px-3 text-ink-soft hover:bg-ink/5 hover:text-ink`,
}

export const cardStyles =
  'rounded-2xl border border-rule bg-card shadow-[0_1px_2px_rgb(29_27_23/0.04),0_12px_32px_-18px_rgb(29_27_23/0.18)]'

export const inputStyles =
  'h-12 w-full rounded-lg border border-rule bg-card px-4 text-[16px] text-ink placeholder:text-ink-faint ' +
  'transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15'

export const kickerStyles = 'font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint'
