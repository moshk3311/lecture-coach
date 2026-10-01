// Imports a real deck the way the owner does: node import.js <deck.pptx> [deck.pdf]
// The owner's test decks live in private/decks/ (git ignores it). With the PDF export,
// every slide must get an image.
const fs = require('fs')
const path = require('path')
const { APP, DESKTOP, PHONE, PHONE_LANDSCAPE, checks, launch, leftovers, open, overflow, run, shot } = require('./lib/harness')
const { createDb } = require('./lib/mock')

run(async () => {
  const [pptx, pdf] = process.argv.slice(2).map((file) => path.resolve(file))
  if (!pptx || !fs.existsSync(pptx) || (pdf && !fs.existsSync(pdf))) throw new Error('usage: node import.js <deck.pptx> [deck.pdf]')
  const browser = await launch()
  const errors = []
  const { problems, check } = checks()
  const db = createDb()

  const { ctx, page } = await open(browser, db, DESKTOP, errors)
  await page.goto(`${APP}/lectures/new`)
  await page.locator('input[type=file][accept^=".pptx"]').setInputFiles(pptx)
  await page.getByText(/\d+ שקפים/).first().waitFor({ timeout: 30000 })
  if (pdf) await page.locator('input[type=file][accept^=".pdf"]').setInputFiles(pdf)
  await shot(page, 'import-form')
  await page.getByRole('button', { name: 'צור הרצאה' }).click()
  await page.getByRole('heading', { name: 'שקפים', exact: true }).waitFor({ timeout: 120000 })
  await ctx.close()

  const lecture = db.lectures[0]
  const slides = db.slides.filter((s) => s.lecture_id === lecture.id)
  const sentences = db.sentences.filter((t) => slides.some((s) => s.id === t.slide_id))
  check(slides.length > 0, `"${lecture.title}": ${slides.length} slides, ${sentences.length} script sentences`)
  if (pdf) check(slides.every((s) => s.image_path), `every slide has an image (${slides.filter((s) => s.image_path).length}/${slides.length})`)

  const views = [
    ['lecture', `/lectures/${lecture.id}`, { m: PHONE, d: DESKTOP }],
    ['present', `/present/${lecture.id}`, { ml: PHONE_LANDSCAPE, d: DESKTOP }],
  ]
  for (const [name, route, viewports] of views) {
    for (const [size, viewport] of Object.entries(viewports)) {
      const view = await open(browser, db, viewport, errors)
      await view.page.goto(`${APP}${route}`)
      await view.page.getByText(name === 'present' ? `1/${slides.length}` : 'שקפים').first().waitFor()
      await view.page.waitForFunction(() => [...document.querySelectorAll('main img')].every((img) => img.complete))
      await shot(view.page, `import-${name}-${size}`, name !== 'present')
      check((await overflow(view.page)) === 0, `${name}-${size} does not scroll sideways`)
      await view.ctx.close()
    }
  }

  await browser.close()
  return [...problems, ...leftovers(errors, db)]
})
