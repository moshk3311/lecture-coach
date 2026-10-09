// A made-up tip catalog for the mocked coach_tips table. The owner's real tips are private
// (private/coach-tips/) and never go into the repo; these only exercise the screens.
const { USER_ID } = require('./mock')

const source = (n) => ({ speaker: `Speaker ${n}`, title: `Talk ${n}`, event: 'TEDx', url: `https://www.youtube.com/watch?v=test${n}` })

const tip = (slug, category, triggers, title_he, body_he, example_en = null, rotating = false) => ({
  id: `00000000-0000-4000-8000-0000000000${String(slug.length).padStart(2, '0')}`,
  user_id: USER_ID, slug, category, triggers, rotating, title_he, body_he, example_en,
  sources: [source(slug.length)], active: true, updated_at: '2026-10-06T10:00:00Z',
})

const coachTipRows = () => [
  tip('e2e-overrun-a', 'structure', ['slide_overrun', 'overtime'], 'לכל משפט יש סיבה', 'אם אתה לא יודע למה משפט נמצא ב-script, תוציא אותו.', 'Cut it, then say it again.'),
  tip('e2e-overrun-b', 'structure', ['slide_overrun'], 'שקף אחד, מסר אחד', 'בחר מסר אחד לכל שקף, והשאר את שאר הפרטים לשאלות.'),
  tip('e2e-intro', 'structure', ['long_intro'], 'פתיחה ב-20 מילים', 'הצג את עצמך במשפט קצר ולא ברשימת הישגים.', 'I help teams catch leaks early.'),
  tip('e2e-pace', 'delivery', ['pace_fast'], 'להאט לפני המסר', 'קצב רגוע משדר חשיבות. האט במשפט המרכזי.'),
  tip('e2e-first', 'mindset', ['first_run'], 'הגרסה הראשונה לא אמורה להיות טובה', 'חזרה חלשה היא חלק מהדרך.'),
  tip('e2e-repeat', 'practice', ['repeat_issue'], 'תקן דבר אחד', 'בחר נושא אחד מהדוח ותקן רק אותו בחזרה הבאה.'),
  tip('e2e-rotating', 'stage', [], 'גוף פתוח אל הקהל', 'ידיים שלובות סוגרות את הגוף. השאר אותו פתוח.', null, true),
]

module.exports = { coachTipRows }
