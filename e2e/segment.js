// The sentence editor and the script estimates on the lecture page (ARCHITECTURE §5.1): split, merge,
// reorder and paragraphs, saved only on "save", with the sentence ids kept; words and speaking time
// per slide against the planned time.
const { APP, DESKTOP, PHONE, checks, launch, leftovers, open, overflow, run, shot } = require('./lib/harness')
const { basicSeed } = require('./lib/seeds')

const sentencesOf = (db, slide) => db.sentences.filter((s) => s.slide_id === slide.id).sort((a, b) => a.position - b.position)
const textsOf = (db, slide) => sentencesOf(db, slide).map((s) => s.text)
const LONG = 'Prepared for the McKinsey session with the operations team, the plant managers and the safety leads from every site in the region.'

run(async () => {
  const browser = await launch()
  const errors = []
  const { problems, check } = checks()
  const db = basicSeed()
  const id = db.lectureId
  const [one, two] = db.slides.filter((s) => s.lecture_id === id).sort((a, b) => a.position - b.position)
  sentencesOf(db, one)[1].text = LONG
  const { ctx, page } = await open(browser, db, DESKTOP, errors)
  const card = (n) => page.locator('ol > li').nth(n - 1)
  const rows = (n) => card(n).getByRole('list', { name: 'משפטים' }).locator('li')

  await page.goto(`${APP}/lectures/${id}`)
  await page.getByText('Fertilizer Plants').first().waitFor()

  // 1. Estimates: words and speaking time per slide, against the planned time (12 minutes for 3 slides).
  check(await page.getByText('דיבור משוער').isVisible(), 'the header shows the estimated speaking time')
  check((await card(2).innerText()).includes('8 מילים'), 'a slide shows its word count')
  check(await card(2).getByText('קצר מהזמן המתוכנן').isVisible(), 'a script far shorter than its planned time is flagged')
  check((await card(3).getByRole('button', { name: /משפטים/ }).count()) === 0, 'a slide without a script has no sentence editor')

  // 2. Split before a word; nothing is saved until "save", and the first part keeps the id.
  const firstId = sentencesOf(db, two)[0].id
  await card(2).getByRole('button', { name: 'משפטים (1)' }).click()
  await card(2).getByRole('button', { name: 'פצל', exact: true }).click()
  await card(2).getByRole('button', { name: 'פצל לפני process,' }).click()
  check((await rows(2).count()) === 2, 'splitting makes two sentences')
  check(textsOf(db, two).length === 1, 'nothing is saved before "save"')
  await card(2).getByRole('button', { name: 'שמור' }).click()
  await card(2).getByRole('button', { name: 'משפטים (2)' }).waitFor()
  check(
    JSON.stringify(textsOf(db, two)) === JSON.stringify(['We will cover scale,', 'process, quality and safety.']) &&
      sentencesOf(db, two)[0].id === firstId,
    'the split is saved and the first part keeps its id',
  )

  // 3. A long sentence is flagged; reorder, then cancel leaves the script as it was.
  await card(1).getByRole('button', { name: 'משפטים (2)' }).click()
  check(await rows(1).nth(1).getByText('ארוך לתרגול').isVisible(), 'a sentence over 20 words is flagged')
  await rows(1).nth(1).getByRole('button', { name: 'הזז למעלה' }).click()
  check((await rows(1).nth(0).innerText()).includes('McKinsey'), 'a sentence moves up')
  await shot(page, 'segment')
  await card(1).getByRole('button', { name: 'בטל' }).click()
  check(textsOf(db, one)[0].startsWith('Short operational'), 'cancel keeps the stored order')

  // 4. Merge, and a new paragraph.
  const oneId = sentencesOf(db, one)[0].id
  await card(1).getByRole('button', { name: 'משפטים (2)' }).click()
  await rows(1).nth(1).getByRole('button', { name: 'פסקה חדשה' }).click()
  check((await rows(1).nth(1).getByRole('button', { name: 'פסקה חדשה' }).getAttribute('aria-pressed')) === 'true', 'a sentence can open a paragraph')
  await rows(1).nth(0).getByRole('button', { name: 'מזג עם הבא' }).click()
  check((await rows(1).count()) === 1, 'merging makes one sentence')
  await card(1).getByRole('button', { name: 'שמור' }).click()
  await card(1).getByRole('button', { name: 'משפטים (1)' }).waitFor()
  check(textsOf(db, one).length === 1 && sentencesOf(db, one)[0].id === oneId, 'the merge is saved and keeps the first id')
  await ctx.close()

  // 5. The editor on a phone.
  {
    const { ctx: phone, page: mobile } = await open(browser, db, PHONE, errors)
    await mobile.goto(`${APP}/lectures/${id}`)
    const second = mobile.locator('ol > li').nth(1)
    await second.getByRole('button', { name: 'משפטים (2)' }).click()
    await second.getByRole('button', { name: 'פצל', exact: true }).first().click()
    await mobile.waitForTimeout(300)
    await shot(mobile, 'segment-m')
    const px = await overflow(mobile)
    check(px === 0, `no sideways scroll on a phone (${px}px)`)
    await phone.close()
  }

  await browser.close()
  return [...problems, ...leftovers(errors, db)]
})
