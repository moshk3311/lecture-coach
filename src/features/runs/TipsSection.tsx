import { ExternalLink, Lightbulb } from 'lucide-react'
import { En } from '../../components/En'
import { MixedText } from '../../components/MixedText'
import { stagger } from '../../components/stagger'
import { cardStyles } from '../../components/styles'
import { formatClock } from '../../lib/format'
import { TRIGGER_LABELS_HE } from '../../lib/tips'
import type { RunDetail } from './api'
import { CATEGORY_LABELS_HE, tipCards, useRuleTips, type TipCardData } from './coachTips'
import { savedRunReport } from './feedback'

/**
 * "Tips for the next take" (§5.8): the rule tips at once, each with the measurement behind it, then
 * what Gemini added from listening once the AI feedback has been requested.
 */
export function TipsSection({ run }: { run: RunDetail }) {
  const { tips, catalog, loading, failed } = useRuleTips(run)
  const ai = savedRunReport(run.ai_feedback)?.tips ?? []
  const cards = tipCards(tips ?? [], catalog, ai)
  // Nothing to show (no catalog and no Gemini tips): the report simply ends without this section.
  if (!cards.length && (!loading || failed)) return null

  return (
    <section className={`${cardStyles} rise-in mt-6 p-5 md:p-6`} style={stagger(7)}>
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Lightbulb size={18} className="text-accent" aria-hidden="true" />
        טיפים לחזרה הבאה
      </h2>
      {loading && !cards.length ? (
        <p className="mt-3 text-sm text-ink-faint" role="status">
          טוען טיפים…
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {cards.map((card) => (
            <TipCard key={card.key} card={card} />
          ))}
        </ol>
      )}
      {!ai.length ? (
        <p className="mt-4 text-xs text-ink-faint">אחרי שתבקש משוב AI, Gemini יצמיד כל טיפ לרגע בהקלטה ויוסיף טיפים ממה ששמע.</p>
      ) : null}
    </section>
  )
}

function originLabel(card: TipCardData): string {
  if (card.origin === 'rotating') return 'עוד טיפ מהמחברת'
  if (card.origin === 'general') return 'הצעה כללית, לא מהמחברת'
  const label = card.trigger ? TRIGGER_LABELS_HE[card.trigger] : ''
  return card.origin === 'heard' ? `נשמע בהקלטה${label ? `: ${label}` : ''}` : label
}

function TipCard({ card }: { card: TipCardData }) {
  const { moment } = card
  return (
    <li className="rounded-xl border border-rule p-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {card.category ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">{CATEGORY_LABELS_HE[card.category] ?? card.category}</span>
        ) : null}
        <span className={card.origin === 'general' ? 'font-medium text-warn' : 'text-ink-faint'}>{originLabel(card)}</span>
      </p>
      <h3 className="mt-2 font-medium">
        <MixedText text={card.title_he} />
      </h3>
      {card.evidence_he ? (
        <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-sm">
          <MixedText text={card.evidence_he} />
        </p>
      ) : null}
      {moment ? (
        <p className="mt-2 text-sm leading-relaxed">
          <MixedText text={moment.personal_he} />
          {moment.said_en ? (
            <>
              {' '}
              <En className="text-ink-soft italic">“{moment.said_en}”</En>
            </>
          ) : null}
          {moment.slide || moment.startSec !== null ? (
            <span className="text-xs text-ink-faint">
              {' '}
              ({moment.slide ? `שקף ${moment.slide}` : ''}
              {moment.slide && moment.startSec !== null ? ' · ' : ''}
              {moment.startSec !== null ? <span dir="ltr">{formatClock(moment.startSec)}</span> : null})
            </span>
          ) : null}
        </p>
      ) : null}
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        <MixedText text={card.body_he} />
      </p>
      {card.example_en ? (
        <p className="mt-3 text-sm">
          <span className="text-xs text-ink-faint">דוגמה: </span>
          <En className="font-medium">{card.example_en}</En>
        </p>
      ) : null}
      {card.sources.length ? (
        <ul className="mt-3 space-y-1 text-xs text-ink-faint">
          {card.sources.map((source) => (
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
