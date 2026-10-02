// In-memory Supabase for screenshot checks: auth, PostgREST tables and RPCs, Storage and the
// azure-token and ai functions, all answered inside the browser. It never touches the real project.
// REF must match VITE_SUPABASE_URL in .env.local: the app builds its session key from it.
const crypto = require('crypto')
const { aiReport, keywordsOf } = require('./ai')
const REF = 'gzppgmoegcsdtovcdkmy'
const BASE = `https://${REF}.supabase.co`
const USER_ID = '11111111-1111-4111-8111-111111111111'

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const accessToken = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
  sub: USER_ID,
  role: 'authenticated',
  aud: 'authenticated',
  email: 'owner@example.com',
  exp: 4102444800,
})}.c2lnbmF0dXJl`

const user = {
  id: USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'owner@example.com',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-09-24T10:00:00Z',
}

const session = {
  access_token: accessToken,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: 'fake-refresh',
  user,
}

function uuid() {
  return crypto.randomUUID()
}

/**
 * The mocked database. Scripts read it to check what the app saved, and can set:
 * usageMinutes (Azure minutes used this month, default 12), failSaveAttempt (save_attempt
 * answers 500), loseSaveReply (save_attempt saves, then answers 500), aiFails (a Hebrew
 * message the ai function answers with a 503).
 */
function createDb(seed = {}) {
  return {
    lectures: seed.lectures ?? [],
    slides: seed.slides ?? [],
    sentences: seed.sentences ?? [],
    storage: seed.storage ?? {}, // bucket/path -> { contentType, body }
    attempts: seed.attempts ?? [],
    wordResults: seed.wordResults ?? [],
    settings: {
      user_id: USER_ID, voice: 'en-US-AndrewNeural', slow_rate: '-25%', send_audio_to_llm: true, privacy_ack: false,
      azure_minutes_cap: 300, ...seed.settings,
    },
    aiCalls: [], // { action, payload } of every ai function call
    ranges: [], // Range headers of signed downloads
    log: [], // "METHOD /path?query" of every request
  }
}

function deckOf(db, lecture) {
  const slides = db.slides
    .filter((s) => s.lecture_id === lecture.id)
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      ...s,
      sentences: db.sentences.filter((t) => t.slide_id === s.id).sort((a, b) => a.position - b.position),
    }))
  return { ...lecture, slides }
}

function parseEq(url, key) {
  const v = url.searchParams.get(key)
  return v && v.startsWith('eq.') ? v.slice(3) : null
}

/** Routes the page's Supabase calls to `db`; signed in as USER_ID unless `signedIn` is false. */
async function setupMock(page, db, { signedIn = true } = {}) {
  if (signedIn) {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value)
      },
      [`sb-${REF}-auth-token`, JSON.stringify(session)],
    )
  }

  await page.route(`${BASE}/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const method = req.method()
    const accept = req.headers()['accept'] || ''
    const wantsObject = accept.includes('vnd.pgrst.object')
    const body = req.postData()
    const json = (status, data, headers = {}) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', ...headers },
        body: data === undefined ? '' : JSON.stringify(data),
      })
    db.log.push(`${method} ${url.pathname}${url.search}`)

    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
      })
    }

    const p = url.pathname
    if (p === '/auth/v1/user') return json(200, user)
    if (p.startsWith('/auth/v1/')) return json(200, {})

    if (p === '/rest/v1/user_settings') {
      if (method === 'PATCH') {
        Object.assign(db.settings, JSON.parse(body))
        return json(204)
      }
      return json(200, wantsObject ? db.settings : [db.settings])
    }

    if (p === '/rest/v1/lectures') {
      const select = url.searchParams.get('select') || '*'
      const id = parseEq(url, 'id')
      if (method === 'GET') {
        let rows = db.lectures.filter((l) => !id || l.id === id)
        if (select.includes('slides(count)')) {
          rows = rows
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .map((l) => ({ ...l, slides: [{ count: db.slides.filter((s) => s.lecture_id === l.id).length }] }))
        } else if (select.includes('sentences')) {
          rows = rows.map((l) => deckOf(db, l))
        }
        if (wantsObject) return rows[0] ? json(200, rows[0]) : json(406, { code: 'PGRST116', message: 'no rows' })
        return json(200, rows)
      }
      if (method === 'POST') {
        const input = JSON.parse(body)
        const now = new Date().toISOString()
        const row = { id: uuid(), user_id: USER_ID, audience: null, target_minutes: null, pptx_path: null, status: 'draft', created_at: now, updated_at: now, ...input }
        db.lectures.push(row)
        return json(201, wantsObject ? row : [row])
      }
      if (method === 'PATCH') {
        const patch = JSON.parse(body)
        const row = db.lectures.find((l) => l.id === id)
        Object.assign(row, patch, { updated_at: new Date().toISOString() })
        return json(200, wantsObject ? row : [row])
      }
      if (method === 'DELETE') {
        db.lectures = db.lectures.filter((l) => l.id !== id)
        db.attempts.forEach((a) => a.lecture_id === id && (a.lecture_id = null)) // on delete set null
        const slideIds = db.slides.filter((s) => s.lecture_id === id).map((s) => s.id)
        db.slides = db.slides.filter((s) => s.lecture_id !== id)
        db.sentences = db.sentences.filter((t) => !slideIds.includes(t.slide_id))
        return json(204)
      }
    }

    if (p === '/rest/v1/slides' && method === 'PATCH') {
      const id = parseEq(url, 'id')
      const patch = JSON.parse(body)
      const row = db.slides.find((s) => s.id === id)
      if (!row) return json(200, [])
      Object.assign(row, patch)
      return json(200, wantsObject ? row : [row])
    }

    if (p === '/rest/v1/rpc/import_slides') {
      const { p_lecture_id, p_slides } = JSON.parse(body)
      p_slides.forEach((s, i) => {
        const slide = {
          id: uuid(), lecture_id: p_lecture_id, position: i + 1, title: s.title || null, source_text: s.source_text || null,
          source_notes: s.source_notes || null, intent_notes: null, image_path: null, transition_line: null,
          planned_seconds: null, keywords: null, memo_level: 0,
        }
        db.slides.push(slide)
        ;(s.sentences || []).forEach((t, j) => db.sentences.push(sentenceRow(p_lecture_id, slide.id, j + 1, t.text, t.starts_paragraph)))
      })
      return json(200, p_slides.length)
    }

    if (p === '/functions/v1/azure-token') {
      return json(500, { message_he: 'בשרת חסרים הסודות AZURE_SPEECH_KEY / AZURE_SPEECH_REGION.' })
    }

    // The ai function answers like Gemini would, after a short wait; run_report saves the report.
    if (p === '/functions/v1/ai' && method === 'POST') {
      const { action, payload = {} } = JSON.parse(body || '{}')
      db.aiCalls.push({ action, payload })
      await new Promise((resolve) => setTimeout(resolve, 400))
      if (db.aiFails) return json(503, { message_he: db.aiFails })
      if (action === 'run_report') {
        const row = db.attempts.find((a) => a.id === payload.attempt_id)
        if (!row) return json(404, { message_he: 'החזרה לא נמצאה.' })
        row.ai_feedback = aiReport({ heardAudio: db.settings.send_audio_to_llm && row.audio_path !== null })
        return json(200, row.ai_feedback)
      }
      if (action === 'keywords') return json(200, { keywords: keywordsOf(payload.slide_script) })
      return json(400, { message_he: 'פעולה לא מוכרת.' })
    }

    if (p === '/rest/v1/v_month_usage') {
      const row = { minutes: db.usageMinutes ?? 12 }
      return json(200, wantsObject ? row : [row])
    }

    if (p === '/rest/v1/rpc/save_attempt') {
      if (db.failSaveAttempt) return json(500, { message: 'save failed (mock)' })
      const { p: payload } = JSON.parse(body)
      const { words, ...fields } = payload
      let row = db.attempts.find((a) => a.id === payload.id)
      if (!row) {
        row = { user_id: USER_ID, created_at: new Date().toISOString(), pron_score: null, accuracy: null, fluency: null, completeness: null, prosody: null, wpm: null, filler_count: null, long_pause_count: null, azure_raw: null, ai_feedback: null, recognized_text: null, slide_id: null, sentence_id: null }
        db.attempts.push(row)
      }
      Object.assign(row, fields)
      if (words) {
        db.wordResults = db.wordResults.filter((w) => w.attempt_id !== payload.id).concat(words.map((w, i) => ({ id: i, attempt_id: payload.id, position: i + 1, ...w })))
      }
      if (db.loseSaveReply) return json(500, { message: 'reply lost (mock)' })
      return json(200, payload.id)
    }

    if (p === '/rest/v1/attempts' && method === 'PATCH') {
      const ids = (url.searchParams.get('id') || '').replace(/^in\.\(|\)$/g, '').split(',')
      const patch = JSON.parse(body)
      const rows = db.attempts.filter((a) => ids.includes(a.id))
      rows.forEach((a) => Object.assign(a, patch))
      return json(204)
    }

    if (p === '/rest/v1/attempts' && method === 'GET') {
      const id = parseEq(url, 'id')
      const lectureId = parseEq(url, 'lecture_id')
      const mode = parseEq(url, 'mode')
      const withAudio = url.searchParams.get('audio_path') === 'not.is.null'
      let rows = db.attempts.filter(
        (a) => (!id || a.id === id) && (!lectureId || a.lecture_id === lectureId) && (!mode || a.mode === mode) && (!withAudio || a.audio_path !== null),
      )
      rows = rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
      if ((url.searchParams.get('select') || '').includes('word_results')) {
        rows = rows.map((a) => ({ ...a, word_results: db.wordResults.filter((w) => w.attempt_id === a.id) }))
      }
      if (wantsObject) return rows[0] ? json(200, rows[0]) : json(406, { code: 'PGRST116' })
      return json(200, rows)
    }

    if (p === '/rest/v1/rpc/save_slide_script') {
      const { p_slide_id, p_sentences } = JSON.parse(body)
      const slide = db.slides.find((s) => s.id === p_slide_id)
      const keep = new Set(p_sentences.filter((t) => t.id).map((t) => t.id))
      db.sentences = db.sentences.filter((t) => t.slide_id !== p_slide_id || keep.has(t.id))
      p_sentences.forEach((t, i) => {
        if (t.id) {
          const row = db.sentences.find((r) => r.id === t.id)
          Object.assign(row, { text: t.text, position: i + 1, starts_paragraph: !!t.starts_paragraph })
        } else {
          db.sentences.push(sentenceRow(slide.lecture_id, p_slide_id, i + 1, t.text, t.starts_paragraph))
        }
      })
      return json(200, db.sentences.filter((t) => t.slide_id === p_slide_id).sort((a, b) => a.position - b.position))
    }

    // Storage
    const sign = p.match(/^\/storage\/v1\/object\/sign\/([^/]+)$/)
    if (sign && method === 'POST') {
      const { paths } = JSON.parse(body)
      return json(200, paths.map((path) => ({ path, signedURL: `/object/sign/${sign[1]}/${path}?token=t`, error: null })))
    }
    const signed = p.match(/^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/)
    if (signed && method === 'POST') {
      return json(200, { signedURL: `/object/sign/${signed[1]}/${signed[2]}?token=t` })
    }
    if (signed && method === 'GET') {
      const item = db.storage[`${signed[1]}/${decodeURIComponent(signed[2])}`]
      if (!item) return route.fulfill({ status: 404, body: 'not found' })
      // Byte ranges like Storage serves them (▶ You downloads only the clip it plays).
      const header = req.headers()['range']
      if (header) db.ranges.push(header)
      const range = /^bytes=(\d+)-(\d*)$/.exec(header || '')
      if (range) {
        const size = item.body.length
        const from = Number(range[1])
        const to = Math.min(size - 1, range[2] ? Number(range[2]) : size - 1)
        if (from >= size) return route.fulfill({ status: 416, headers: { 'access-control-allow-origin': '*', 'content-range': `bytes */${size}` } })
        return route.fulfill({
          status: 206,
          contentType: item.contentType,
          body: item.body.subarray(from, to + 1),
          headers: { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes', 'content-range': `bytes ${from}-${to}/${size}` },
        })
      }
      return route.fulfill({ status: 200, contentType: item.contentType, body: item.body, headers: { 'access-control-allow-origin': '*' } })
    }
    const list = p.match(/^\/storage\/v1\/object\/list\/([^/]+)$/)
    if (list) {
      const { prefix } = JSON.parse(body)
      const names = Object.keys(db.storage)
        .filter((k) => k.startsWith(`${list[1]}/${prefix}/`))
        .map((k) => ({ name: k.slice(`${list[1]}/${prefix}/`.length), id: k }))
      return json(200, names)
    }
    const obj = p.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/)
    if (obj && method === 'HEAD') {
      const found = Boolean(db.storage[`${obj[1]}/${decodeURIComponent(obj[2])}`])
      return route.fulfill({ status: found ? 200 : 404, headers: { 'access-control-allow-origin': '*' } })
    }
    if (obj && method === 'GET') {
      const item = db.storage[`${obj[1]}/${decodeURIComponent(obj[2])}`]
      if (!item) return route.fulfill({ status: 404, body: 'not found' })
      return route.fulfill({ status: 200, contentType: item.contentType, body: item.body, headers: { 'access-control-allow-origin': '*' } })
    }
    if (obj && (method === 'POST' || method === 'PUT')) {
      db.storage[`${obj[1]}/${decodeURIComponent(obj[2])}`] = parseUpload(req.headers()['content-type'], req.postDataBuffer())
      return json(200, { Key: `${obj[1]}/${obj[2]}`, Id: uuid() })
    }
    const del = p.match(/^\/storage\/v1\/object\/([^/]+)$/)
    if (del && method === 'DELETE') {
      const { prefixes } = JSON.parse(body)
      for (const k of prefixes) delete db.storage[`${del[1]}/${k}`]
      return json(200, [])
    }

    db.unmocked = [...(db.unmocked ?? []), `${method} ${url.pathname}${url.search}`]
    return json(404, { message: 'unmocked' })
  })
}

/** supabase-js sends Blobs as multipart form data from the browser; keep only the file part. */
function parseUpload(contentType, body) {
  const m = /boundary=(.+)$/.exec(contentType || '')
  if (!m) return { contentType, body }
  const boundary = Buffer.from(`--${m[1]}`)
  let start = body.indexOf(boundary)
  while (start !== -1) {
    const next = body.indexOf(boundary, start + boundary.length)
    if (next === -1) break
    const part = body.subarray(start + boundary.length, next)
    const headerEnd = part.indexOf('\r\n\r\n')
    const headers = part.subarray(0, headerEnd).toString()
    const type = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]
    if (type && !/cacheControl/.test(headers)) return { contentType: type, body: part.subarray(headerEnd + 4, part.length - 2) }
    start = next
  }
  return { contentType, body }
}

function sentenceRow(lectureId, slideId, position, text, startsParagraph) {
  return {
    id: uuid(), lecture_id: lectureId, slide_id: slideId, position, text, starts_paragraph: !!startsParagraph,
    original_text: null, change_notes: null, ref_voice: null, ref_audio_path: null, ref_audio_slow_path: null,
    ref_word_timings: null, updated_at: new Date().toISOString(),
  }
}

module.exports = { setupMock, createDb, sentenceRow, uuid, USER_ID, BASE }
