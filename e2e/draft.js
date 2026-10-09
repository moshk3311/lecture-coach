// AI script drafting on the lecture page (ARCHITECTURE §5.1), with the mocked ai function: the pencil of
// one slide (intent in, proposal out, accepted or refused) and a draft for every slide without a script.
const { APP, DESKTOP, PHONE, checks, launch, leftovers, open, overflow, run, shot, until } = require('./lib/harness')
const { basicSeed } = require('./lib/seeds')

const scriptOf = (db, slide) =>
  db.sentences
    .filter((s) => s.slide_id === slide.id)
    .sort((a, b) => a.position - b.position)
    .map((s) => s.text)
    .join(' ')
const drafts = (db) => db.aiCalls.filter((c) => c.action === 'draft_script')

run(async () => {
  const browser = await launch()
  const errors = []
  const { problems, check } = checks()
  const db = basicSeed()
  const id = db.lectureId
  const [one, two, three] = db.slides.filter((s) => s.lecture_id === id).sort((a, b) => a.position - b.position)
  const { ctx, page } = await open(browser, db, DESKTOP, errors)
  const card = (n) => page.locator('ol > li').nth(n - 1)

  // 1. The pencil of a slide that has a script: a proposal that replaces it only when accepted.
  await page.goto(`${APP}/lectures/${id}`)
  await page.getByText('Fertilizer Plants').first().waitFor()
  const before = scriptOf(db, one)
  await card(1).getByRole('button', { name: 'הצע מלל' }).click()
  await card(1).getByLabel(/מה חשוב לך להגיד/).fill('להדגיש את הבטיחות')
  await card(1).getByRole('button', { name: 'הצע מלל' }).last().click()
  await card(1).getByText('This is slide 1.').waitFor()
  check(drafts(db).length === 1 && drafts(db)[0].payload.intent === 'להדגיש את הבטיחות', 'the intent goes with the request')
  check(db.slides.find((s) => s.id === one.id).intent_notes === 'להדגיש את הבטיחות', 'the intent is saved with the slide')
  check(await card(1).getByText('התחשבתי במה שכתבת.').isVisible(), 'the notes in Hebrew are shown')
  check(await card(1).getByText('Now, on to slide 2.').isVisible(), 'the bridge sentence is shown')
  check(await card(1).getByText('Gemini ראה רק את הטקסט').isVisible(), 'a slide without a picture says Gemini saw only the text')
  check(scriptOf(db, one) === before, 'nothing is saved before it is accepted')
  await shot(page, 'draft-proposal')
  await card(1).getByRole('button', { name: 'דחה' }).click()
  await page.waitForTimeout(200)
  check(scriptOf(db, one) === before && (await card(1).getByText('This is slide 1.').count()) === 0, 'refusing keeps the script and closes the proposal')

  await card(1).getByRole('button', { name: 'הצע מלל' }).last().click()
  await card(1).getByText('This is slide 1.').waitFor()
  await card(1).getByRole('button', { name: 'החלף את התסריט' }).click()
  await until(() => scriptOf(db, one) === 'This is slide 1. It shows Fertilizer Plants.')
  check(true, 'accepting replaces the script')
  await until(() => db.slides.find((s) => s.id === one.id).transition_line === 'Now, on to slide 2.')
  check(true, 'accepting saves the bridge sentence')
  check(await card(1).getByText('This is slide 1. It shows Fertilizer Plants.').isVisible(), 'the slide list shows the new script')

  // 2. A draft for every slide without a script (slide 3), saved at once, with a note to review it.
  const before3 = scriptOf(db, three)
  check(before3 === '', 'slide 3 starts without a script')
  await page.getByRole('button', { name: 'טיוטה ל-1 שקפים בלי תסריט' }).click()
  await page.getByText('נוספו טיוטות ל-1 שקפים').waitFor()
  const last = drafts(db).at(-1)
  check(last.payload.slide_id === three.id && !('intent' in last.payload), 'only the slide without a script is drafted, with its saved intent')
  check(scriptOf(db, three) === 'This is slide 3. It shows At a glance.', 'the draft of slide 3 is saved')
  check(!db.slides.find((s) => s.id === three.id).transition_line, 'the last slide gets no bridge sentence')
  check(await card(3).getByText('נוסח ב-AI').isVisible(), 'a drafted slide is marked for review')
  check((await page.getByRole('button', { name: /טיוטה ל-\d+ שקפים/ }).count()) === 0, 'no draft button when every slide has a script')
  await shot(page, 'draft-all')

  // 3. A failure stops the run and says why; the slide keeps its (empty) script.
  db.sentences = db.sentences.filter((s) => s.slide_id !== two.id)
  await page.reload()
  await page.getByRole('button', { name: 'טיוטה ל-1 שקפים בלי תסריט' }).waitFor()
  db.aiFails = 'Gemini עמוס או שהמכסה היומית נגמרה. נסה שוב מאוחר יותר.'
  await page.getByRole('button', { name: 'טיוטה ל-1 שקפים בלי תסריט' }).click()
  await page.getByRole('alert').waitFor()
  check((await page.getByRole('alert').innerText()).includes('שקף 2') && (await page.getByRole('alert').innerText()).includes('Gemini עמוס'), 'a failure names the slide and the reason')
  check(scriptOf(db, two) === '', 'a failed draft saves nothing')
  db.aiFails = null
  await ctx.close()

  // 4. The panel on a phone.
  {
    const { ctx: phone, page: mobile } = await open(browser, db, PHONE, errors)
    await mobile.goto(`${APP}/lectures/${id}`)
    const first = mobile.locator('ol > li').first()
    await first.getByRole('button', { name: 'הצע מלל' }).click()
    await first.getByRole('button', { name: 'הצע מלל' }).last().click()
    await first.getByText('This is slide 1.').waitFor()
    await mobile.waitForTimeout(300)
    await shot(mobile, 'draft-m')
    const px = await overflow(mobile)
    check(px === 0, `no sideways scroll on a phone (${px}px)`)
    await phone.close()
  }

  await browser.close()
  return [...problems, ...leftovers(errors, db)]
})
