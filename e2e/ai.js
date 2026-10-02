// The ai function in the app, mocked (ARCHITECTURE §5.7, §9). Run report: the one-time privacy
// notice, a report with Corrections whose ▶ You clip is cut from the recording with a byte range, the
// American voice without Azure keys, a failed request and its retry, and the audio switch.
// Presenter: memorization level L3 with Gemini's keywords, after a failure and a retry.
const { APP, DESKTOP, PHONE, checks, launch, leftovers, open, overflow, run, shot, until } = require('./lib/harness')
const { basicSeed, seedTake } = require('./lib/seeds')

run(async () => {
  const browser = await launch()
  const errors = []
  const { problems, check } = checks()
  const db = basicSeed()
  const id = db.lectureId
  const takeId = seedTake(db, 1, id, {}, { audioSeconds: 20 })
  const take = db.attempts.find((a) => a.id === takeId)
  const { ctx, page } = await open(browser, db, DESKTOP, errors)

  // 1. The first request comes after the privacy notice and acknowledges it.
  await page.goto(`${APP}/lectures/${id}/runs/${takeId}`)
  await page.getByText('לפני הפעם הראשונה').waitFor()
  await shot(page, 'ai-before')
  await page.getByRole('button', { name: 'הבנתי, בקש משוב' }).click()
  await page.getByText('Gemini מאזין לחזרה').waitFor()
  await page.getByText('תיקונים: איך אמריקאים אומרים את זה').waitFor({ timeout: 10000 })
  check(db.aiCalls.length === 1 && db.aiCalls[0].action === 'run_report', 'one run_report call for the take')
  check(db.settings.privacy_ack === true, 'asking after the notice acknowledges it')
  check(take.ai_feedback?.corrections.length === 3, 'the report is saved with the take')

  // 2. ▶ You plays a clip fetched with a byte range; a correction without a time has none.
  const you = page.getByRole('button', { name: 'הקול שלך', disabled: false })
  await you.first().waitFor()
  check((await you.count()) === 2, `▶ You on the 2 corrections with a time (${await you.count()})`)
  check(db.ranges.some((r) => /^bytes=\d+-\d+$/.test(r)), `the clip is a byte range (${db.ranges.join(', ')})`)
  await you.first().click()
  await page.getByRole('button', { name: 'עצור' }).first().waitFor()
  check(true, 'the clip plays')
  await page.getByText('הקול האמריקאי לא זמין כרגע').waitFor()
  check(true, 'without Azure keys the American voice says why')
  await shot(page, 'ai-report')

  // 3. A failed request keeps the report on screen and can be asked again.
  db.aiFails = 'Gemini עמוס או שהמכסה היומית נגמרה. נסה שוב מאוחר יותר.'
  await page.getByRole('button', { name: 'משוב חדש' }).click()
  await page.getByRole('alert').waitFor()
  check((await page.getByRole('alert').innerText()).includes('Gemini עמוס'), 'a failure shows the function\'s message')
  check(await page.getByText('חזרה בטוחה עם פתיחה חזקה').isVisible(), 'the saved report stays on screen')
  db.aiFails = null
  await page.getByRole('button', { name: 'משוב חדש' }).click()
  await until(() => db.aiCalls.length === 3)
  await page.getByRole('alert').waitFor({ state: 'detached' })
  check(true, 'asking again clears the error')

  // 4. With audio off in Settings, the next report has no corrections.
  await page.goto(`${APP}/settings`)
  await page.getByRole('switch', { name: 'שליחת אודיו ל-Gemini' }).click()
  await until(() => db.settings.send_audio_to_llm === false)
  const quietId = seedTake(db, 2, id, {}, { audioSeconds: 5 })
  await page.goto(`${APP}/lectures/${id}/runs/${quietId}`)
  await page.getByText('שליחת ההקלטה ל-Gemini כבויה בהגדרות').waitFor()
  await page.getByRole('button', { name: 'בקש משוב' }).click()
  await page.getByText('Gemini לא שמע את ההקלטה, ולכן אין תיקונים.').waitFor()
  check(db.attempts.find((a) => a.id === quietId).ai_feedback.heard_audio === false, 'the report says Gemini did not hear the take')
  await ctx.close()

  // 5. The report with corrections on a phone.
  {
    const { ctx: phone, page: mobile } = await open(browser, db, PHONE, errors)
    await mobile.goto(`${APP}/lectures/${id}/runs/${takeId}`)
    await mobile.getByText('תיקונים: איך אמריקאים אומרים את זה').waitFor()
    await mobile.waitForTimeout(300)
    await shot(mobile, 'ai-report-m')
    const px = await overflow(mobile)
    check(px === 0, `no sideways scroll on a phone (${px}px)`)
    await phone.close()
  }

  // 6. L3 in the presenter: L2 with the reason while Gemini fails, then its keywords, saved and reused.
  {
    const { ctx: present, page: presenter } = await open(browser, db, DESKTOP, errors)
    const keywordCalls = () => db.aiCalls.filter((c) => c.action === 'keywords').length
    const first = db.slides.find((s) => s.position === 1)
    await presenter.goto(`${APP}/present/${id}`)
    await presenter.getByText('Now on screen').waitFor()
    db.aiFails = 'בשרת חסרים הסודות GEMINI_API_KEY / GEMINI_MODEL.'
    await presenter.getByRole('button', { name: 'L3' }).click()
    await presenter.getByText('אין מילות מפתח').waitFor()
    check((await presenter.getByRole('alert').innerText()).includes('GEMINI_API_KEY'), 'L3 without Gemini says why')
    db.aiFails = null
    await presenter.getByRole('alert').getByRole('button', { name: 'נסה שוב' }).click()
    await until(() => (first.keywords ?? []).length > 0)
    check(first.memo_level === 3, 'the slide remembers L3')
    check(first.keywords.join(', ') === 'Short, operational, overview, fertilizer', `the keywords are saved with the slide (${first.keywords.join(', ')})`)
    await presenter.getByText('אין מילות מפתח').waitFor({ state: 'detached' })
    await shot(presenter, 'present-l3', false)
    await presenter.keyboard.press('ArrowRight')
    await presenter.keyboard.press('ArrowLeft')
    await presenter.getByText('Script · L3').waitFor()
    check(keywordCalls() === 2, `saved keywords are reused (${keywordCalls()} calls: one failed, one good)`)
    await present.close()
  }

  await browser.close()
  return [...problems, ...leftovers(errors, db)]
})
