// A full-run take with the fake mic: record from the presenter view, move two slides, stop,
// then check the saved attempt, the run report and the run history.
const { APP, DESKTOP, checks, launch, leftovers, open, run, shot } = require('./lib/harness')
const { basicSeed } = require('./lib/seeds')

run(async () => {
  const browser = await launch()
  const errors = []
  const { problems, check } = checks()
  const db = basicSeed()
  const id = db.lectureId
  const { ctx, page } = await open(browser, db, DESKTOP, errors)

  await page.goto(`${APP}/present/${id}`)
  await page.getByText('Now on screen').waitFor()
  await page.keyboard.press('r')
  await page.getByRole('button', { name: 'עצור הקלטה (R)' }).waitFor()
  await page.waitForTimeout(2500)
  await shot(page, 'take-recording', false)
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(1500)
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(1000)
  await page.keyboard.press('r')
  await page.getByText('Run report').waitFor({ timeout: 20000 })

  const attempt = db.attempts[0]
  const wav = db.storage[`recordings/${attempt?.audio_path}`]
  check(attempt?.mode === 'full_run', 'the take is saved as a full_run attempt')
  check(wav?.body.length > 44, `its recording is uploaded (${wav?.body.length ?? 0} bytes)`)
  check(attempt?.metrics.visits.length === 3, `every slide change is timestamped (${attempt?.metrics.visits.length ?? 0} visits)`)
  await shot(page, 'take-report')
  check(await page.getByText('זמן לכל שקף').isVisible(), 'the report shows the time per slide')

  await page.goto(`${APP}/lectures/${id}`)
  await page.getByText('חזרות מוקלטות').waitFor()
  await shot(page, 'take-history')

  await ctx.close()
  await browser.close()
  return [...problems, ...leftovers(errors, db)]
})
