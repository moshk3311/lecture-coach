import { ComingSoon } from '../../components/ComingSoon'
import { PageHeader } from '../../components/PageHeader'
import { stagger } from '../../components/stagger'

export function ProgressPage() {
  return (
    <>
      <PageHeader
        number="04"
        section="Progress"
        title="התקדמות"
        subtitle="איך ההגייה שלך משתפרת לאורך זמן, ומה כדאי לתרגל עכשיו."
      />
      <ComingSoon
        sprint="Sprint 4"
        title="לוח התקדמות"
        description="הנתונים כבר נאספים במבנה הנכון; הלוח יוצג כשיהיו הקלטות."
        items={[
          'מגמת ציון ההגייה לפי יום, ודיוק, שטף ואינטונציה',
          'דקות תרגול בשבוע',
          'הצלילים והמילים החלשים, וכמה מילים כבר נשלטו',
          'מד שימוש במכסת Azure החודשית',
        ]}
        style={stagger(3)}
      />
    </>
  )
}
