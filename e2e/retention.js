// Recording retention (ARCHITECTURE §6): the newest 10 takes keep their recordings, takes of
// deleted lectures lose theirs, and a take discarded after a failed save leaves no file behind.
const { APP, DESKTOP, PHONE, checks, launch, leftovers, open, overflow, run, shot, until } = require('./lib/harness')
const { basicSeed, seedTake } = require('./lib/seeds')

const recordings = (db) => Object.keys(db.storage).filter((key) => key.startsWith('recordings/'))
const withAudio = (db) => db.attempts.filter((a) => a.audio_path !== null)

/** Records a short take from the presenter view and stops it. */
async function recordTake(page, lectureId) {
  await page.goto(`${APP}/present/${lectureId}`)
  await page.getByRole('button', { name: 'הקלט חזרה (R)' }).waitFor()
  await page.keyboard.press('r')
  await page.getByRole('button', { name: 'עצור הקלטה (R)' }).waitFor()
  await page.waitForTimeout(1200)
  await page.keyboard.press('r')
}

run(async () => {
  const browser = await launch()
  const errors = []
  const { problems, check } = checks()
  const db = basicSeed()
  const id = db.lectureId
  const ids = Array.from({ length: 11 }, (_, i) => seedTake(db, i + 1, id))
  const deadId = seedTake(db, 30, null) // a newer take of a lecture deleted earlier

  // 1. A new take makes 12 live recordings + 1 of a deleted lecture → the newest 10 stay.
  {
    const { ctx, page } = await open(browser, db, DESKTOP, errors)
    await recordTake(page, id)
    await page.getByText('Run report').waitFor({ timeout: 20000 })
    await until(() => withAudio(db).length === 10)
    const pruned = db.attempts.filter((a) => a.audio_path === null).map((a) => a.id)
    check(recordings(db).length === 10, `10 recordings stay (${recordings(db).length})`)
    check([ids[0], ids[1], deadId].every((p) => pruned.includes(p)) && pruned.length === 3, 'the 2 oldest and the deleted lecture\'s take lost theirs')
    check(withAudio(db).every((a) => db.storage[`recordings/${a.audio_path}`]), 'every audio_path left points to a file')
    await ctx.close()
  }

  // 2. Report and history of a pruned take, on a phone and a desktop.
  for (const [size, viewport] of [['m', PHONE], ['d', DESKTOP]]) {
    const { ctx, page } = await open(browser, db, viewport, errors)
    await page.goto(`${APP}/lectures/${id}/runs/${ids[0]}`)
    await page.getByText('נמחקה אוטומטית').waitFor()
    check((await page.getByRole('button', { name: 'הרץ הערכה' }).count()) === 0, `${size}: a pruned take has no assessment button`)
    await shot(page, `retention-report-${size}`)
    await page.goto(`${APP}/lectures/${id}/runs/${ids[5]}`)
    await page.locator('audio').waitFor()
    check((await page.getByRole('button', { name: 'הרץ הערכה' }).count()) === 1, `${size}: a kept take plays and can be assessed`)
    await page.goto(`${APP}/lectures/${id}`)
    await page.getByText('חזרות מוקלטות').waitFor()
    check((await page.getByText('בלי הקלטה').count()) === 2, `${size}: the history marks the 2 takes without a recording`)
    check((await overflow(page)) === 0, `${size}: the lecture page does not scroll sideways`)
    await shot(page, `retention-history-${size}`)
    await ctx.close()
  }

  // 3. The save fails after the upload, then the take is discarded: the upload is deleted.
  {
    db.failSaveAttempt = true
    const before = new Set(recordings(db))
    const { ctx, page } = await open(browser, db, DESKTOP, errors)
    await recordTake(page, id)
    await page.getByText('השמירה נכשלה').waitFor({ timeout: 20000 })
    const uploaded = recordings(db).filter((key) => !before.has(key))
    await page.getByRole('button', { name: 'מחק', exact: true }).click()
    await until(() => recordings(db).length === before.size)
    check(uploaded.length === 1 && !recordings(db).includes(uploaded[0]), 'a discarded failed save deletes its upload')
    db.failSaveAttempt = false
    await ctx.close()
  }

  // 4. The save went through but its reply got lost: discarding keeps the saved take's file.
  {
    db.loseSaveReply = true
    const before = new Set(recordings(db))
    const { ctx, page } = await open(browser, db, DESKTOP, errors)
    await recordTake(page, id)
    await page.getByText('השמירה נכשלה').waitFor({ timeout: 20000 })
    const uploaded = recordings(db).filter((key) => !before.has(key))
    await page.getByRole('button', { name: 'מחק', exact: true }).click()
    await page.waitForTimeout(1500)
    check(uploaded.length === 1 && recordings(db).includes(uploaded[0]), 'a discarded take that was saved after all keeps its file')
    db.loseSaveReply = false
    await ctx.close()
  }

  // 5. Deleting the lecture deletes its takes' recordings; the attempts stay.
  {
    const { ctx, page } = await open(browser, db, DESKTOP, errors)
    const attempts = db.attempts.length
    await page.goto(`${APP}/lectures/${id}`)
    await page.getByRole('button', { name: 'מחיקה', exact: true }).click()
    await page.getByRole('button', { name: 'מחק לצמיתות' }).click()
    await until(() => recordings(db).length === 0)
    check(withAudio(db).length === 0 && db.attempts.length === attempts, 'deleting the lecture deletes its recordings and keeps its reports')
    await ctx.close()
  }

  await browser.close()
  return [...problems, ...leftovers(errors, db)]
})
