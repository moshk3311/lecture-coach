import { useState } from 'react'

type SlideFrameProps = {
  imageUrl: string | null | undefined
  title: string | null
  /** Slide text shown when there is no image (large frames only). */
  text?: string | null
  className?: string
  /** Large frames show the slide text in the text-only fallback. */
  size?: 'thumb' | 'large'
}

/** A 16:9 slide: its image, or a text card with the title while there is none. */
export function SlideFrame({ imageUrl, title, text, className = '', size = 'thumb' }: SlideFrameProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = imageUrl && failedUrl !== imageUrl

  return (
    <div
      dir="ltr"
      lang="en"
      className={`relative aspect-video overflow-hidden rounded-lg border border-rule bg-card ${className}`}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={title ?? ''}
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : size === 'large' ? (
        <div className="absolute inset-0 flex flex-col overflow-hidden p-[6%] text-left">
          <p className="text-[clamp(1rem,2.4vw,2.25rem)] leading-tight font-semibold text-ink">{title || 'Untitled slide'}</p>
          {text ? (
            <p className="mt-[3%] line-clamp-[8] text-[clamp(0.75rem,1.3vw,1.25rem)] leading-snug whitespace-pre-line text-ink-soft">
              {text}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="absolute inset-0 grid place-items-center p-2 text-center">
          <p className="line-clamp-3 text-[11px] leading-tight font-medium text-ink-soft">{title || '—'}</p>
        </div>
      )}
    </div>
  )
}
