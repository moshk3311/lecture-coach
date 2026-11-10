// Seed data: two lectures (one with a 3-slide script) and helpers for saved takes.
const { createDb, sentenceRow, uuid, USER_ID } = require('./mock')
const { coachTipRows } = require('./tips')

const LECTURE_ID = '22222222-2222-4222-8222-222222222222'

function basicSeed() {
  const lecture = {
    id: LECTURE_ID, user_id: USER_ID, title: 'Fertilizer Plants — Operations Overview', audience: 'McKinsey consultants',
    target_minutes: 12, pptx_path: null, status: 'draft', created_at: '2026-09-25T10:00:00Z', updated_at: '2026-09-26T10:00:00Z',
  }
  const slides = [
    ['Fertilizer Plants', ['Short operational overview of the fertilizer plants.', 'Prepared for the McKinsey session.']],
    ['Agenda', ['We will cover scale, process, quality and safety.']],
    ['At a glance', []],
  ].map(([title, sentences], i) => ({
    id: uuid(), lecture_id: LECTURE_ID, position: i + 1, title, source_text: title, source_notes: null, intent_notes: null,
    image_path: null, transition_line: null, planned_seconds: null, keywords: null, memo_level: 0, _sentences: sentences,
  }))
  const sentences = slides.flatMap((s) => s._sentences.map((text, j) => sentenceRow(LECTURE_ID, s.id, j + 1, text, j === 0)))
  slides.forEach((s) => delete s._sentences)
  const other = {
    id: uuid(), user_id: USER_ID, title: 'שיחת פתיחה לכנס', audience: null, target_minutes: null, pptx_path: null,
    status: 'draft', created_at: '2026-09-20T10:00:00Z', updated_at: '2026-09-21T10:00:00Z',
  }
  const db = createDb({ lectures: [lecture, other], slides, sentences, coachTips: coachTipRows() })
  db.lectureId = LECTURE_ID
  return db
}

/** Timing of a 10-minute take that stayed on the first slide (RunTiming in src/lib/metrics.ts). */
const timing = {
  version: 1,
  totalSeconds: 610,
  targetSeconds: 720,
  visits: [{ position: 1, start: 0, end: 610 }],
  slides: [1, 2, 3].map((position) => ({
    position, title: `Slide ${position}`, seconds: position === 1 ? 610 : 0, plannedSeconds: 240,
    windowStart: (position - 1) * 240, windowEnd: position * 240, firstStart: position === 1 ? 0 : null,
    status: position === 1 ? 'long' : 'skipped',
  })),
}

/** A 16 kHz mono WAV of `seconds` with a quiet 220 Hz tone, so clips cut from it play. */
function wavBody(seconds) {
  const samples = Math.round(seconds * 16000)
  const body = Buffer.alloc(44 + samples * 2)
  body.write('RIFF', 0)
  body.writeUInt32LE(36 + samples * 2, 4)
  body.write('WAVEfmt ', 8)
  body.writeUInt32LE(16, 16)
  body.writeUInt16LE(1, 20) // PCM
  body.writeUInt16LE(1, 22) // mono
  body.writeUInt32LE(16000, 24)
  body.writeUInt32LE(32000, 28)
  body.writeUInt16LE(2, 32)
  body.writeUInt16LE(16, 34)
  body.write('data', 36)
  body.writeUInt32LE(samples * 2, 40)
  for (let i = 0; i < samples; i++) body.writeInt16LE(Math.round(2000 * Math.sin((2 * Math.PI * 220 * i) / 16000)), 44 + i * 2)
  return body
}

/**
 * Adds a saved take n minutes after 09:00 on 28 Sep, with its recording in Storage; returns its id.
 * The recording is a bare header unless `audioSeconds` asks for real audio.
 */
function seedTake(db, n, lectureId, fields = {}, { audioSeconds = 0 } = {}) {
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  const audioPath = `${USER_ID}/${id}.wav`
  db.storage[`recordings/${audioPath}`] = { contentType: 'audio/wav', body: audioSeconds ? wavBody(audioSeconds) : Buffer.alloc(44) }
  db.attempts.push({
    id, user_id: USER_ID, lecture_id: lectureId, mode: 'full_run', reference_text: 'Hello.', audio_path: audioPath,
    duration_sec: 610, metrics: timing, created_at: new Date(Date.UTC(2026, 8, 28, 9, n)).toISOString(),
    pron_score: null, accuracy: null, fluency: null, completeness: null, prosody: null, wpm: null, filler_count: null,
    long_pause_count: null, azure_raw: null, ai_feedback: null, recognized_text: null, slide_id: null, sentence_id: null,
    ...fields,
  })
  return id
}

module.exports = { LECTURE_ID, basicSeed, seedTake, timing, wavBody }
