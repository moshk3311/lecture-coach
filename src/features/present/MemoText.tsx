import { memoTokens, type MemoLevel } from './memo'

type MemoTextProps = {
  text: string
  level: MemoLevel
  keywords?: string[]
  className?: string
}

/** Script text at a memorization level; hidden letters keep their width, so lines keep their shape. */
export function MemoText({ text, level, keywords, className = '' }: MemoTextProps) {
  const paragraphs = text.split('\n').filter((p) => p.trim())
  return (
    <div dir="ltr" lang="en" className={`[font-variant-ligatures:none] ${className}`}>
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="mb-[0.7em] last:mb-0">
          {memoTokens(paragraph, level, keywords).map((token, j) => (
            <span key={j}>
              {token.shown}
              {token.hidden ? (
                <span className="rounded-[3px] bg-ink/10 text-transparent select-none" aria-hidden="true">
                  {token.hidden}
                </span>
              ) : null}
            </span>
          ))}
        </p>
      ))}
    </div>
  )
}
