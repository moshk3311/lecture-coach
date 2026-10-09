// Coach tips in the run report (ARCHITECTURE §5.8), on a made-up catalog: the rule-based tips with
// their evidence, saved with the take, rotated away on the next take, and a phone layout check.
const { APP, DESKTOP, PHONE, checks, launch, leftovers, open, overflow, run, shot, until } = require('./lib/harness')
const { assessedFields, basicSeed, seedTake } = require('./lib/seeds')

const patches = (db) => db.log.filter((line) => line.startsWith('PATCH /rest/v1/attempts')).length
const slugsOf = (db, id) => (db.attempts.find((a) => a.id === id).metrics.tips ?? []).map((t) => t.slug)

run(async () => {
  const browser = await launch()
  const errors = []
  const { problems, check } = checks()
  const db = basicSeed()
  const id = db.lectureId
  const first = seedTake(db, 1, id)
  const second = seedTake(db, 2, id, assessedFields)
  const cards = (page) => page.locator('section', { has: page.getByRole('heading', { name: 'טיפים לחזרה הבאה' }) }).locator('ol > li')
  const { ctx, page } = await open(browser, db, DESKTOP, errors)

  // 1. The first take: tips from its timing, with the measurements as evidence, saved with the take.
  await page.goto(`${APP}/lectures/${id}/runs/${first}`)
  await page.getByRole('heading', { name: 'טיפים לחזרה הבאה' }).waitFor()
  await cards(page).first().waitFor()
  check((await cards(page).count()) === 3, `3 tips on the first take (${await cards(page).count()})`)
  check(await page.getByText('שקף 1 ארך 10:10 מול 4:00 מתוכנן').isVisible(), 'the slide that ran long shows its times')
  check(await page.getByText('השקף הראשון ארך 10:10').isVisible(), 'the long opening shows its time')
  check(await page.getByText('זו החזרה הראשונה של ההרצאה הזו').isVisible(), 'the first take is named')
  const link = page.getByRole('link', { name: /Speaker/ }).first()
  check((await link.getAttribute('href'))?.startsWith('https://www.youtube.com/'), 'a tip links to its source')
  check((await link.getAttribute('target')) === '_blank', 'the source opens in a new tab')
  check((await page.locator('[dir="ltr"][lang="en"]', { hasText: 'script' }).count()) > 0, 'English words inside Hebrew text are wrapped LTR')
  await until(() => slugsOf(db, first).length === 3)
  check(true, `the tips are saved with the take (${slugsOf(db, first).join(', ')})`)
  check(db.attempts.find((a) => a.id === first).metrics.totalSeconds === 610, 'saving the tips keeps the take\'s metrics')
  await shot(page, 'tips')

  // 1b. The AI feedback adds Gemini's anchors and extras to the same cards.
  await page.getByRole('button', { name: 'הבנתי, בקש משוב' }).click()
  await page.getByText('הפתיחה נמשכה זמן רב לפני שהגעת לנושא.').waitFor({ timeout: 10000 })
  check(await page.getByText('“short operational overview”').isVisible(), 'a rule tip shows what was said at its moment')
  check(await page.getByText('נשמע בהקלטה: קצב מהיר').isVisible(), 'a tip Gemini heard is labeled as such')
  check(await page.getByText('הצעה כללית, לא מהמחברת').isVisible(), 'Gemini\'s own tip is labeled as general')
  check((await cards(page).count()) === 5, `3 rule tips and 2 from Gemini (${await cards(page).count()})`)
  check((await page.getByText('Meet Dana, the night-shift operator.').count()) === 1, 'the general tip has its own example')
  await shot(page, 'tips-ai')

  // 2. Reading the report again changes nothing and saves nothing.
  const before = patches(db)
  await page.reload()
  await cards(page).first().waitFor()
  await page.waitForTimeout(600)
  check(patches(db) === before, 'a second visit does not save again')

  // 3. The next take rotates away from the tips just shown and notices the repeated issue.
  await page.goto(`${APP}/lectures/${id}/runs/${second}`)
  await cards(page).first().waitFor()
  await until(() => slugsOf(db, second).length > 0)
  const overrun = (slugs) => slugs.find((s) => s.startsWith('e2e-overrun'))
  check(overrun(slugsOf(db, first)) !== overrun(slugsOf(db, second)), `the overrun tip rotates (${overrun(slugsOf(db, first))} → ${overrun(slugsOf(db, second))})`)
  check(await page.getByText('גם בחזרה הקודמת הנושא המרכזי היה: שקף שחרג מהחלון').isVisible(), 'the repeated issue is named')
  await ctx.close()

  // 4. A take with fast speech gets the pace tip, with the measurement behind it.
  {
    const solo = basicSeed()
    const assessed = seedTake(solo, 1, solo.lectureId, assessedFields)
    const { ctx: fast, page: fastPage } = await open(browser, solo, DESKTOP, errors)
    await fastPage.goto(`${APP}/lectures/${solo.lectureId}/runs/${assessed}`)
    await fastPage.getByText('171 מילים לדקה', { exact: false }).first().waitFor()
    check(true, 'a fast take shows its words per minute as evidence')
    await fast.close()
  }

  // 5. The tips on a phone.
  {
    const { ctx: phone, page: mobile } = await open(browser, db, PHONE, errors)
    await mobile.goto(`${APP}/lectures/${id}/runs/${first}`)
    await cards(mobile).first().waitFor()
    await mobile.waitForTimeout(300)
    await shot(mobile, 'tips-m')
    const px = await overflow(mobile)
    check(px === 0, `no sideways scroll on a phone (${px}px)`)
    await phone.close()
  }

  // 6. Without a catalog the report ends without the section.
  {
    const bare = basicSeed()
    bare.coachTips = []
    const take = seedTake(bare, 1, bare.lectureId)
    const { ctx: none, page: nonePage } = await open(browser, bare, DESKTOP, errors)
    await nonePage.goto(`${APP}/lectures/${bare.lectureId}/runs/${take}`)
    await nonePage.getByText('משוב AI ותיקונים').waitFor()
    await nonePage.waitForTimeout(600)
    check((await nonePage.getByRole('heading', { name: 'טיפים לחזרה הבאה' }).count()) === 0, 'no catalog, no tips section')
    await none.close()
  }

  await browser.close()
  return [...problems, ...leftovers(errors, db)]
})
