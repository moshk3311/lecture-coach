import { LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { En } from '../../components/En'
import { PageHeader } from '../../components/PageHeader'
import { stagger } from '../../components/stagger'
import { buttonStyles, cardStyles, kickerStyles } from '../../components/styles'
import { useAuth } from '../auth/useAuth'
import { UsageMeter } from '../runs/UsageMeter'
import { AzureCheck } from './AzureCheck'
import { DEFAULT_SETTINGS, useUserSettings } from './useUserSettings'

export function SettingsPage() {
  const { session, signOut } = useAuth()
  const { data, isError } = useUserSettings()
  const settings = { ...DEFAULT_SETTINGS, ...data }

  return (
    <>
      <PageHeader number="05" section="Settings" title="הגדרות" subtitle="החשבון שלך, ברירות המחדל ובדיקת החיבור ל-Azure." />

      <div className="grid gap-5 md:grid-cols-2">
        <section className={`${cardStyles} rise-in p-6`} style={stagger(3)}>
          <h2 className="font-display text-xl font-semibold">חשבון</h2>
          <p className={`${kickerStyles} mt-4`}>
            <En>Signed in as</En>
          </p>
          <p className="mt-1 truncate text-[17px]" dir="ltr" style={{ textAlign: 'right' }}>
            {session?.user.email}
          </p>
          <button type="button" onClick={() => void signOut()} className={`${buttonStyles.secondary} mt-6`}>
            <LogOut size={16} aria-hidden="true" />
            יציאה מהחשבון
          </button>
        </section>

        <section className={`${cardStyles} rise-in p-6`} style={stagger(4)}>
          <h2 className="font-display text-xl font-semibold">ברירות מחדל</h2>
          <dl className="mt-4 divide-y divide-rule">
            <Row label="קול אמריקאי">
              <En className="font-mono text-sm">{settings.voice}</En>
            </Row>
            <Row label="קצב איטי">
              <En className="font-mono text-sm">{settings.slow_rate}</En>
            </Row>
            <Row label="שליחת אודיו ל-Gemini">{settings.send_audio_to_llm ? 'פעיל' : 'כבוי'}</Row>
            <Row label="מכסת Azure לחודש">{settings.azure_minutes_cap} דקות</Row>
          </dl>
          <p className="mt-4 text-sm text-ink-faint">
            {isError ? 'לא הצלחתי לטעון את ההגדרות; מוצגות ברירות המחדל.' : 'עריכה תגיע יחד עם הפיצ׳רים שמשתמשים בהן.'}
          </p>
        </section>

        <div className="rise-in md:col-span-2" style={stagger(5)}>
          <UsageMeter />
        </div>

        <div className="rise-in md:col-span-2" style={stagger(6)}>
          <AzureCheck voice={settings.voice} />
        </div>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-ink-soft">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
