import { ComingSoon } from '../../components/ComingSoon'
import { PageHeader } from '../../components/PageHeader'
import { stagger } from '../../components/stagger'

export function PracticePage() {
  return (
    <>
      <PageHeader
        number="02"
        section="Practice"
        title="תרגול"
        subtitle="משפט אחר משפט: שומעים איך אמריקאי אומר את זה, מקליטים, ומקבלים ציון לכל מילה וצליל."
      />
      <ComingSoon
        sprint="Sprint 4"
        title="תרגול ממוקד"
        description="התרגול נשען על התסריט שייכתב ב-Sprint 3 ועל המילים החלשות שיתגלו בחזרות."
        items={[
          'הקלטה של משפט וציונים: הגייה, דיוק, שטף ואינטונציה',
          'השוואה בין ההקלטה שלך לקול אמריקאי, רגיל ואיטי',
          'משוב בעברית עם דוגמאות ותרגילים באנגלית',
          'תרגול חוזר של המילים והצלילים שהכי קשים לך',
        ]}
        style={stagger(3)}
      />
    </>
  )
}
