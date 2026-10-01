// Screenshots of every screen on a phone (390 px) and on a desktop, from seed data.
// Fails when a screen scrolls sideways, the page logs an error or a request is not mocked.
const { APP, DESKTOP, PHONE, PHONE_LANDSCAPE, launch, leftovers, open, overflow, run, shot } = require('./lib/harness')
const { createDb } = require('./lib/mock')
const { assessedFields, basicSeed, seedTake } = require('./lib/seeds')

run(async () => {
  const browser = await launch()
  const errors = []
  const problems = []
  const db = basicSeed()
  const id = db.lectureId
  const runId = seedTake(db, 1, id)
  const assessedId = seedTake(db, 2, id, assessedFields)
  const empty = createDb()

  // [name, route, text that shows the screen is ready, options]
  const screens = [
    ['login', '/login', 'כניסה', { db: empty, signedIn: false }],
    ['lectures-empty', '/', 'עוד אין הרצאות', { db: empty }],
    ['lectures', '/', '2 הרצאות'],
    ['lecture-new', '/lectures/new', 'צור הרצאה'],
    ['lecture', `/lectures/${id}`, 'חזרות מוקלטות'],
    ['present-picker', '/present', 'Fertilizer Plants'],
    ['present', `/present/${id}`, '1/3', { viewports: { m: PHONE, ml: PHONE_LANDSCAPE, d: DESKTOP }, fullPage: false }],
    ['run', `/lectures/${id}/runs/${runId}`, 'הערכת הגייה'],
    ['run-assessed', `/lectures/${id}/runs/${assessedId}`, 'הגייה ודיבור'],
    ['practice', '/practice', 'תרגול ממוקד'],
    ['progress', '/progress', 'לוח התקדמות'],
    ['settings', '/settings', 'שימוש ב-Azure החודש'],
  ]

  for (const [name, route, ready, options = {}] of screens) {
    const viewports = options.viewports ?? { m: PHONE, d: DESKTOP }
    for (const [size, viewport] of Object.entries(viewports)) {
      const { ctx, page } = await open(browser, options.db ?? db, viewport, errors, { signedIn: options.signedIn })
      await page.goto(`${APP}${route}`)
      await page.getByText(ready).first().waitFor()
      await page.waitForTimeout(300)
      await shot(page, `${name}-${size}`, options.fullPage ?? true)
      const px = await overflow(page)
      console.log(`${`${name}-${size}`.padEnd(22)} ${px ? `scrolls sideways by ${px}px` : 'ok'}`)
      if (px) problems.push(`${name}-${size} scrolls sideways by ${px}px`)
      await ctx.close()
    }
  }

  await browser.close()
  return [...problems, ...leftovers(errors, db), ...leftovers([], empty)]
})
