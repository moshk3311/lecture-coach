import { ExternalLink, Lightbulb } from 'lucide-react'
import { En } from '../../components/En'
import { MixedText } from '../../components/MixedText'
import { stagger } from '../../components/stagger'
import { cardStyles } from '../../components/styles'
import { TRIGGER_LABELS_HE, type SelectedTip } from '../../lib/tips'
import { CATEGORY_LABELS_HE, tipSources, useRuleTips, type CoachTip } from './coachTips'
import type { RunDetail } from './api'

/** "Tips for the next take" (§5.8): 2–3 tips from the owner's notebook, each with the measurement behind it. */
export function TipsSection({ run }: { run: RunDetail }) {
  const { tips, catalog, loading, failed } = useRuleTips(run)
  const bySlug = new Map(catalog.map((tip) => [tip.slug, tip]))
  const cards = (tips ?? []).flatMap((chosen) => {
    const tip = bySlug.get(chosen.slug)
    return tip ? [{ chosen, tip }] : []
  })
  // No catalog (not imported, or it failed to load): the report simply ends without this section.
  if (failed || (!loading && !cards.length)) return null

  return (
    <section className={`${cardStyles} rise-in mt-6 p-5 md:p-6`} style={stagger(7)}>
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Lightbulb size={18} className="text-accent" aria-hidden="true" />
        טיפים לחזרה הבאה
      </h2>
      {loading ? (
        <p className="mt-3 text-sm text-ink-faint" role="status">
          טוען טיפים…
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {cards.map(({ chosen, tip }) => (
            <TipCard key={tip.slug} chosen={chosen} tip={tip} />
          ))}
        </ol>
      )}
    </section>
  )
}

function TipCard({ chosen, tip }: { chosen: SelectedTip; tip: CoachTip }) {
  const sources = tipSources(tip.sources)
  return (
    <li className="rounded-xl border border-rule p-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">{CATEGORY_LABELS_HE[tip.category] ?? tip.category}</span>
        {chosen.trigger ? (
          <span className="text-ink-faint">· {TRIGGER_LABELS_HE[chosen.trigger]}</span>
        ) : (
          <span className="text-ink-faint">· עוד טיפ מהמחברת</span>
        )}
      </p>
      <h3 className="mt-2 font-medium">
        <MixedText text={tip.title_he} />
      </h3>
      {chosen.evidence_he ? (
        <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-sm">
          <MixedText text={chosen.evidence_he} />
        </p>
      ) : null}
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        <MixedText text={tip.body_he} />
      </p>
      {tip.example_en ? (
        <p className="mt-3 text-sm">
          <span className="text-xs text-ink-faint">דוגמה: </span>
          <En className="font-medium">{tip.example_en}</En>
        </p>
      ) : null}
      {sources.length ? (
        <ul className="mt-3 space-y-1 text-xs text-ink-faint">
          {sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-ink">
                מתוך: <En>{source.speaker}</En> — <En>{source.title}</En>
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}
