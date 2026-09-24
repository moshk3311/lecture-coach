import { ComingSoon } from '../../components/ComingSoon'
import { PageHeader } from '../../components/PageHeader'
import { stagger } from '../../components/stagger'

export function PresentPage() {
  return (
    <>
      <PageHeader
        number="03"
        section="Presenter View"
        title="הצגה"
        subtitle="חזרה על ההרצאה כולה: השקף משמאל, התסריט מימין, וטיימר שמראה אם אתה בזמן."
      />
      <div className="grid gap-5 md:grid-cols-2">
        <ComingSoon
          sprint="Sprint 1"
          title="מצב מציג"
          description="מסך חזרות שמחליף את המצגת בזמן האימון."
          items={[
            'השקף הנוכחי והשקף הבא, כדי שהמעבר לא יפתיע',
            'חלון זמן מתוכנן לכל שקף, בצבע ירוק, כתום או אדום',
            'עריכת תסריט במקום, ורמות שינון מטקסט מלא ועד בלי טקסט',
            'קיצורי מקלדת וקליקר, והחלקה בטלפון',
          ]}
          style={stagger(3)}
        />
        <ComingSoon
          sprint="Sprint 2"
          title="הקלטת חזרה ודוח"
          description="מקליטים חזרה מלאה ומקבלים דוח ביצוע."
          items={[
            'זמן כולל וזמן לכל שקף מול התכנון',
            'קצב דיבור, מילות מילוי והפסקות ארוכות',
            'תיקונים: מה נשמע לא טבעי לאוזן אמריקאית, עם השוואת קול',
          ]}
          style={stagger(4)}
        />
      </div>
    </>
  )
}
