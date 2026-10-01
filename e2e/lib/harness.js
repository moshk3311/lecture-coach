// Shared setup for the check scripts: a Chromium with the fake mic, pages wired to the mock,
// screenshots into e2e/out/.
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')
const { fakeMicFile } = require('./fakeMic')
const { setupMock } = require('./mock')

const APP = process.env.APP || 'http://127.0.0.1:5173/#'
const OUT = path.join(__dirname, '..', 'out')
const PHONE = { width: 390, height: 844 }
const PHONE_LANDSCAPE = { width: 844, height: 390 }
const DESKTOP = { width: 1440, height: 900 }

async function launch() {
  fs.mkdirSync(OUT, { recursive: true })
  return chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${fakeMicFile(OUT)}`],
  })
}

/**
 * A new page on the mocked backend. Page errors and console errors land in `errors`;
 * confirm() dialogs are accepted.
 */
async function open(browser, db, viewport, errors, { signedIn = true, ...context } = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'he-IL', reducedMotion: 'reduce', permissions: ['microphone'], ...context })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  // Failed loads are expected: the mocked azure-token answers 500 (no Azure keys).
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
  page.on('dialog', (d) => d.accept())
  await setupMock(page, db, { signedIn })
  return { ctx, page }
}

const shot = (page, name, fullPage = true) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage, animations: 'disabled' })

/** Horizontal page overflow in px (0 means no sideways scroll). */
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

async function until(check, ms = 10000) {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error(`timed out waiting for: ${check}`)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

/** `check(ok, label)` prints a line per expectation and collects the failed ones in `problems`. */
function checks() {
  const problems = []
  const check = (ok, label) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
    if (!ok) problems.push(label)
  }
  return { problems, check }
}

/** Page errors and requests the mock does not know, as problems for `run`. */
function leftovers(errors, db) {
  return [...errors.map((e) => `page error: ${e}`), ...(db.unmocked ?? []).map((r) => `unmocked request: ${r}`)]
}

/** Runs a script; prints a failure and exits with 1 when it throws or reports problems. */
function run(main) {
  main()
    .then((problems = []) => {
      console.log(problems.length ? `\nFAILED:\n- ${problems.join('\n- ')}` : '\nOK')
      process.exit(problems.length ? 1 : 0)
    })
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}

module.exports = { APP, OUT, PHONE, PHONE_LANDSCAPE, DESKTOP, launch, open, shot, overflow, until, checks, leftovers, run }
