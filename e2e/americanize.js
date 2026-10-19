// "Americanize" on the lecture page (ARCHITECTURE §5.1), with the mocked ai function: a slide's saved
// script revised as a word diff with Hebrew reasons, accepted or refused; a script that needs nothing;
// a failure with a retry.
const { APP, DESKTOP, PHONE, checks, launch, leftovers, open, overflow, run, shot, until } = require('./lib/harness')
const { basicSeed } = require('./lib/seeds')

const scriptOf = (db, slide) =>
  db.sentences
    .filter((s) => s.slide_id === slide.id)
    .sort((a, b) => a.position - b.position)
    .map((s) => s.text)
    .join(' ')
const calls = (db) => db.aiCalls.filter((c) => c.action === 'americanize')
const BUTTON = 'תקן לאמריקאית'

run(async () => {
  const browser = await launch()
  const errors = []
  const { problems, check } = checks()
  const db = basicSeed()
  const id = db.lectureId
  const [one, two] = db.slides.filter((s) => s.lecture_id === id).sort((a, b) => a.position - b.position)
  db.slides.find((s) => s.id === two.id).transition_line = 'Now we move on to the safety.'
  const { ctx, page } = await open(browser, db, DESKTOP, errors)
  const card = (n) => page.locator('ol > li').nth(n - 1)

  await page.goto(`${APP}/lectures/${id}`)
  await page.getByText('Fertilizer Plants').first().waitFor()
  check((await card(3).getByRole('button', { name: BUTTON }).count()) === 0, 'a slide without a script has no Americanize button')

  // 1. A script that already sounds right.
  await card(1).getByRole('button', { name: BUTTON }).click()
  await card(1).getByText('אין מה לשנות').waitFor()
  check(calls(db)[0]?.payload.text === scriptOf(db, one), 'the saved script is sent')
  await card(1).getByRole('button', { name: 'סגור' }).click()

  // 2. A script with changes: a diff and the reasons; nothing saved until accepted.
  const before = scriptOf(db, two)
  await card(2).getByRole('button', { name: BUTTON }).click()
  await card(2).getByRole('button', { name: 'קבל את התיקונים' }).waitFor()
  check(calls(db).at(-1).payload.transition_line === 'Now we move on to the safety.', 'the bridge sentence is sent')
  check((await card(2).locator('del', { hasText: 'We will' }).count()) > 0, 'the removed words are struck through')
  check((await card(2).locator('ins', { hasText: "We'll" }).count()) > 0, 'the added words are marked')
  check(await card(2).getByText('בדיבור אומרים').isVisible(), 'each change has its reason in Hebrew')
  check((await card(2).getByRole('list', { name: 'השינויים' }).locator('li').count()) === 2, 'the script and the bridge changes are listed')
  check(scriptOf(db, two) === before, 'nothing is saved before it is accepted')
  await shot(page, 'americanize')
  await card(2).getByRole('button', { name: 'דחה' }).click()
  check(scriptOf(db, two) === before && (await card(2).getByRole('button', { name: BUTTON }).isVisible()), 'refusing keeps the script')

  await card(2).getByRole('button', { name: BUTTON }).click()
  await card(2).getByRole('button', { name: 'קבל את התיקונים' }).click()
  await until(() => scriptOf(db, two) === "We'll cover scale, process, quality and safety.")
  check(true, 'accepting saves the revised script')
  await until(() => db.slides.find((s) => s.id === two.id).transition_line === 'Now we move on to safety.')
  check(true, 'accepting saves the revised bridge sentence')

  // 3. A failure says why and offers a retry.
  db.aiFails = 'Gemini עמוס או שהמכסה היומית נגמרה. נסה שוב מאוחר יותר.'
  await card(1).getByRole('button', { name: BUTTON }).click()
  await card(1).getByRole('alert').waitFor()
  check((await card(1).getByRole('alert').innerText()).includes('Gemini עמוס'), 'a failure shows the reason')
  db.aiFails = null
  await card(1).getByRole('button', { name: 'נסה שוב' }).click()
  await card(1).getByText('אין מה לשנות').waitFor()
  check(true, 'retrying after a failure works')
  await ctx.close()

  // 4. The panel on a phone.
  {
    const { ctx: phone, page: mobile } = await open(browser, db, PHONE, errors)
    db.slides.find((s) => s.id === two.id).transition_line = 'Now we move on to the safety.'
    db.sentences.find((s) => s.slide_id === two.id).text = 'We will cover scale, process, quality and safety.'
    await mobile.goto(`${APP}/lectures/${id}`)
    const second = mobile.locator('ol > li').nth(1)
    await second.getByRole('button', { name: BUTTON }).click()
    await second.getByRole('button', { name: 'קבל את התיקונים' }).waitFor()
    await mobile.waitForTimeout(300)
    await shot(mobile, 'americanize-m')
    const px = await overflow(mobile)
    check(px === 0, `no sideways scroll on a phone (${px}px)`)
    await phone.close()
  }

  await browser.close()
  return [...problems, ...leftovers(errors, db)]
})
