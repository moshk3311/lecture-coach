import { Check, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Alert } from '../../components/Alert'
import { stagger } from '../../components/stagger'
import { buttonStyles, cardStyles, kickerStyles } from '../../components/styles'
import type { RunReportFeedback } from '../../providers'
import { useUpdateUserSettings, useUserSettings } from '../settings/useUserSettings'
import { useRequestRunReport } from './aiReport'
import type { RunDetail } from './api'
import { AmericanVoiceNote, CorrectionCard } from './CorrectionCard'
import { savedRunReport, TOPIC_LABELS } from './feedback'

const dateTime = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Gemini's feedback and Corrections (ARCHITECTURE §5.7). The rest of the report never waits for it. */
export function AiFeedback({ run }: { run: RunDetail }) {
  const report = savedRunReport(run.ai_feedback)
  const request = useRequestRunReport(run.id)
  const { data: settings } = useUserSettings()
  const updateSettings = useUpdateUserSettings()
  const acknowledged = settings?.privacy_ack ?? false
  const sendsAudio = (settings?.send_audio_to_llm ?? true) && Boolean(run.audio_path)

  function ask() {
    // The privacy notice is shown once (§9): asking for feedback after reading it acknowledges it.
    if (!acknowledged) updateSettings.mutate({ privacy_ack: true })
    request.mutate()
  }

  return (
    <section className={`${cardStyles} rise-in mt-6 p-5 md:p-6`} style={stagger(6)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Sparkles size={18} className="text-accent" aria-hidden="true" />
          משוב AI ותיקונים
        </h2>
        {report && !request.isPending ? (
          <button type="button" onClick={ask} className={`${buttonStyles.ghost} h-9 text-sm`}>
            <RefreshCw size={15} aria-hidden="true" />
            משוב חדש
          </button>
        ) : null}
      </div>

      {request.isError ? (
        <div className="mt-4">
          <Alert>{request.error instanceof Error && request.error.message ? request.error.message : 'המשוב נכשל.'}</Alert>
        </div>
      ) : null}

      {request.isPending ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft" role="status">
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          {sendsAudio ? 'Gemini מאזין לחזרה… זה יכול לקחת דקה או שתיים.' : 'Gemini קורא את נתוני החזרה…'}
        </p>
      ) : report ? (
        <Report report={report} run={run} />
      ) : (
        <>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">
            Gemini מאזין לחזרה כמו מאזין אמריקאי ומחזיר משוב על טון, אנרגיה ובהירות, ותיקונים למה שנשמע לא טבעי, עם השוואה לקול
            אמריקאי.
          </p>
          {!sendsAudio ? (
            <p className="mt-3 text-sm text-ink-faint">
              {run.audio_path ? 'שליחת ההקלטה ל-Gemini כבויה בהגדרות' : 'ההקלטה של החזרה הזו נמחקה'}, ולכן המשוב יתבסס על
              המדידות בלבד, בלי תיקונים.
            </p>
          ) : null}
          {!acknowledged ? (
            <div className="mt-4 rounded-xl border border-warn/30 bg-warn-soft p-4 text-sm leading-relaxed">
              <p className="font-medium">לפני הפעם הראשונה</p>
              <p className="mt-1 text-ink-soft">
                בשימוש החינמי, Google עשויה להשתמש במה שנשלח ל-Gemini כדי לשפר את המוצרים שלה, לכן אל תשלח תוכן עבודה חסוי. ההקלטה
                נשלחת כברירת מחדל, כי בלעדיה אין תיקונים. אפשר לכבות את זה ב
                <Link to="/settings" className="underline underline-offset-2">
                  הגדרות
                </Link>
                .
              </p>
            </div>
          ) : null}
          <button type="button" onClick={ask} className={`${buttonStyles.primary} mt-4`}>
            <Sparkles size={18} aria-hidden="true" />
            {request.isError ? 'נסה שוב' : acknowledged ? 'בקש משוב' : 'הבנתי, בקש משוב'}
          </button>
        </>
      )}
    </section>
  )
}

function Report({ report, run }: { report: RunReportFeedback; run: RunDetail }) {
  return (
    <div className="mt-4 space-y-6">
      <p className="max-w-prose leading-relaxed">{report.summary_he}</p>

      {report.strengths_he.length ? (
        <Block title="מה עבד">
          <ul className="space-y-1.5">
            {report.strengths_he.map((strength) => (
              <li key={strength} className="flex gap-2 text-sm leading-relaxed">
                <Check size={16} className="mt-0.5 shrink-0 text-good" aria-hidden="true" />
                {strength}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {report.improvements.length ? (
        <Block title="לשפר בחזרה הבאה">
          <ul className="space-y-2">
            {report.improvements.map((item) => (
              <li key={item.text_he} className="text-sm leading-relaxed">
                <span className="me-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                  {TOPIC_LABELS[item.topic]}
                  {item.slide ? ` · שקף ${item.slide}` : ''}
                </span>
                {item.text_he}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {report.next_session_plan_he ? (
        <Block title="התוכנית לחזרה הבאה">
          <p className="text-sm leading-relaxed">{report.next_session_plan_he}</p>
        </Block>
      ) : null}

      <Block title="תיקונים: איך אמריקאים אומרים את זה">
        {!report.heard_audio ? (
          <p className="text-sm text-ink-faint">Gemini לא שמע את ההקלטה, ולכן אין תיקונים.</p>
        ) : !report.corrections.length ? (
          <p className="text-sm text-ink-faint">Gemini לא מצא משהו שנשמע לא טבעי לאוזן אמריקאית.</p>
        ) : (
          <div className="space-y-3">
            <AmericanVoiceNote text={report.corrections[0]!.american_en} />
            <ol className="space-y-3">
              {report.corrections.map((correction, i) => (
                <CorrectionCard key={`${i}-${correction.you_said_en}`} index={i + 1} correction={correction} run={run} />
              ))}
            </ol>
          </div>
        )}
      </Block>

      <p className={kickerStyles}>
        <span dir="ltr" lang="en">
          Gemini · {report.model}
        </span>{' '}
        · {dateTime.format(new Date(report.created_at))}
      </p>
    </div>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-ink-soft">{title}</h3>
      {children}
    </div>
  )
}
