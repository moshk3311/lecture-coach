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
  }
}

/** The mocked keywords action: the first distinct longer words of the script. */
function keywordsOf(script) {
  return [...new Set((script || '').match(/[A-Za-z][A-Za-z'-]{4,}/g) ?? [])].slice(0, 4)
}

module.exports = { aiReport, keywordsOf }
