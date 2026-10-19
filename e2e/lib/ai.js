// Answers of the mocked ai function (the contract: supabase/functions/ai/contract.ts).

/** A run_report answer as the function saves it; corrections only when Gemini heard the take. */
function aiReport({ heardAudio = true } = {}) {
  return {
    version: 1,
    model: 'gemini-mock',
    prompt_version: '2026-10-01',
    created_at: '2026-10-01T09:30:00.000Z',
    heard_audio: heardAudio,
    summary_he: 'חזרה בטוחה עם פתיחה חזקה. הקצב עלה בשקף 2, והסיום נשמע חלש מדי.',
    strengths_he: ['פתיחה ברורה שמסבירה למה הנושא חשוב.', 'מעברים מסודרים בין השקפים.'],
    improvements: [
      { topic: 'pace', text_he: 'בשקף 2 הקצב עלה: עצור לנשימה אחרי כל מספר.', slide: 2 },
      { topic: 'energy', text_he: 'הרם את הקול במשפט הסיום.', slide: null },
    ],
    next_session_plan_he: 'חזרה אחת על שקף 2 בלבד, עם עצירה של שנייה אחרי כל נתון.',
    corrections: heardAudio
      ? [
          {
            category: 'phrasing',
            severity: 'jarring',
            you_said_en: 'to put AI into work',
            american_en: 'put AI to work',
            principle_he: 'תרגום ישיר מערבב את put to work עם put into practice.',
            slide: 1,
            approx_start_sec: 4.2,
            approx_end_sec: 5.8,
          },
          {
            category: 'pronunciation',
            severity: 'minor',
            you_said_en: 'throughput',
            american_en: 'throughput',
            principle_he: 'ה-th בתחילת המילה היא /θ/: הלשון בין השיניים, לא t.',
            slide: 2,
            approx_start_sec: 11.5,
            approx_end_sec: 12.3,
          },
          {
            category: 'grammar',
            severity: 'minor',
            you_said_en: 'more faster',
            american_en: 'faster',
            principle_he: 'לא מוסיפים more לתואר שכבר בצורת השוואה.',
            slide: null,
            approx_start_sec: null,
            approx_end_sec: null,
          },
        ]
      : [],
    // Anchors for the rule tips and what Gemini heard (slugs of lib/tips.js; the mocked answer is the same for every take).
    tips: heardAudio
      ? [
          {
            slug: 'e2e-intro', from_notebook: true, trigger: 'long_intro', slide: 1, approx_start_sec: 3.1,
            said_en: 'short operational overview', personal_he: 'הפתיחה נמשכה זמן רב לפני שהגעת לנושא.',
            example_en: null, title_he: null, body_he: null,
          },
          {
            slug: 'e2e-pace', from_notebook: true, trigger: 'pace_fast', slide: 2, approx_start_sec: 11.5,
            said_en: 'throughput of the plant', personal_he: 'בשקף 2 הקצב עלה בלי עצירה.',
            example_en: null, title_he: null, body_he: null,
          },
          {
            slug: null, from_notebook: false, trigger: 'no_story', slide: null, approx_start_sec: null,
            said_en: null, personal_he: 'לא שמעתי סיפור או דוגמה עם אדם.',
            example_en: 'Meet Dana, the night-shift operator.', title_he: 'להוסיף דמות אחת', body_he: 'ספר על אדם אחד שחווה את הבעיה.',
          },
        ]
      : [],
  }
}

/** The mocked keywords action: the first distinct longer words of the script. */
function keywordsOf(script) {
  return [...new Set((script || '').match(/[A-Za-z][A-Za-z'-]{4,}/g) ?? [])].slice(0, 4)
}

/** The mocked draft_script action: a short script that names the slide, and a bridge unless it is the last slide. */
function draftOf(slide, intent, isLast) {
  const script = `This is slide ${slide.position}.\nIt shows ${slide.title || 'the plan'}.`
  const words = script.match(/[A-Za-z0-9']+/g).length
  return {
    script_en: script,
    transition_line: isLast ? null : `Now, on to slide ${slide.position + 1}.`,
    notes_he: intent ? 'התחשבתי במה שכתבת.' : 'כתבתי לפי הטקסט שבשקף.',
    words,
    estimated_seconds: Math.round((words * 60) / 140),
    budget_seconds: 50,
    saw_image: Boolean(slide.image_path),
    model: 'gemini-mock',
    prompt_version: '2026-10-07',
  }
}

// "Americanize" as the mock does it: a fixed list of rewrites, each with a Hebrew reason.
const AMERICANIZE_RULES = [
  ['We will', "We'll", 'בדיבור אומרים We\'ll ולא We will.'],
  ['on to the', 'on to', 'בלי the לפני שם של נושא.'],
]

function americanizeOf(text, bridge) {
  const changes = []
  const fix = (value) =>
    AMERICANIZE_RULES.reduce((out, [from, to, reason]) => {
      if (!out.includes(from)) return out
      changes.push({ from, to, reason_he: reason })
      return out.split(from).join(to)
    }, value)
  const textEn = fix(text)
  return { text_en: textEn, transition_line: bridge ? fix(bridge) : null, changes, model: 'gemini-mock', prompt_version: '2026-10-07' }
}

module.exports = { aiReport, americanizeOf, draftOf, keywordsOf }
