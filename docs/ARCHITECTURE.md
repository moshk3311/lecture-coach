# Lecture Coach — Architecture & Build Spec

Version 1.0 · September 2026

A personal app for improving English lecturing skills over time: co-write the script with AI, get American reference audio, record yourself, receive precise pronunciation and delivery feedback, track progress, and rehearse with slides + script side by side.

---

## 1. Context & Goals

**User:** one person, Hebrew-native, presents technical topics in English. Practices on desktop and phone.

| # | Goal |
|---|------|
| G1 | Co-write lecture scripts in natural, spoken American English (from PowerPoint slides + the user's intent). |
| G2 | Measure pronunciation precisely (word + phoneme level, fluency, prosody) after every recording. |
| G3 | Provide American reference audio (normal + slow) for every sentence. |
| G4 | Track progress over time; surface recurring weak words and sounds for targeted practice. |
| G5 | Rehearse the full talk: slides left, script right, memorization support, delivery report (time, pace, fillers, pauses, tone). |
| G6 | Coach stage delivery: after each full take, 2–3 tips for the next take, grounded in the owner's NotebookLM notebook. |

**Non-goals:** multiple users · real-time feedback while speaking (feedback comes after each recording) · editing PowerPoint files · video / body-language analysis.

**Constraints:** zero running cost (free tiers only) · single user · PowerPoint (.pptx) input · Hebrew UI, English content · feedback language mixed (explanations in Hebrew, words/examples/drills in English).

---

## 2. Key Decisions & Trade-offs

| Area | Choice | Why | Trade-off |
|------|--------|-----|-----------|
| Pronunciation scoring | Azure Speech — Pronunciation Assessment, **Free F0** | Dedicated scoring model: word + phoneme accuracy, fluency, completeness, prosody, miscues. F0 never bills — it throttles when the quota is used up. | Azure signup needs a card for verification. 5 audio hours/month, 1 concurrent request. |
| Reference audio | Azure Neural TTS (F0), generated client-side with the Speech SDK | Same account; en-US neural voices; SSML rate control; word-boundary events for highlighting. | 0.5M characters/month → must cache. |
| LLM (script, coaching) | Gemini API, free tier | Free; understands audio natively (tone feedback). | Rate limits. Free-tier data may be used by Google to improve products → no confidential material. Model names change → env var. |
| "Sounds off to an American ear" detection | Gemini **listens to the raw audio**, not the transcript | Transcription can silently "fix" errors; listening catches phrasing, grammar, pronunciation and intonation as a US listener hears them. | Gemini timestamps are approximate → anchored to Azure word timings. Audio is sent to Google (free tier). |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) | Familiar; keeps API keys server-side; RLS. | Free-tier caps (projects, storage, inactivity pausing). |
| Frontend hosting | GitHub Pages | Free, familiar. | SPA routing → use `HashRouter`. |
| Slide images (Sprint 1) | The owner uploads a PDF export of the deck; PDF.js renders it in the browser | No server, no cost; PowerPoint's own PDF is the most faithful rendering. | One extra export step per deck. A LibreOffice converter on a VPS was considered and dropped (Sprint 1). |
| Feedback timing | After each recording | Simpler, more accurate, cheaper than streaming analysis. | No live cues while speaking. |
| Provider abstraction | `SpeechProvider` / `LlmProvider` interfaces | Swap Gemini → Claude API (or Azure → self-hosted) later without rewrites. | Slight upfront structure. |
| Coach tips source | The owner's NotebookLM notebook, imported by Claude on request into a private `coach_tips` table | Tips come from talks the owner chose; rules pick them from measured data, so they show even when Gemini fails. | The app cannot read NotebookLM → catalog updates are manual. Tip content stays in the DB, not in this public repo. |

---

## 3. System Overview

```
┌──────────────── PWA (React + Vite + TS, GitHub Pages) ─────────────────┐
│  Script Studio │ Practice │ Present │ Progress │ Settings               │
│                                                                         │
│  Mic → AudioWorklet → PCM16 / 16 kHz / mono                            │
│          ├──► Azure Speech SDK (pronunciation assessment, WebSocket)   │
│          └──► WAV blob ──► Supabase Storage                            │
│  Azure Speech SDK (TTS) ──► reference MP3 ──► Supabase Storage (cache) │
└────────┬──────────────────────────────┬────────────────────────────────┘
         │ supabase-js (user JWT)       │ short-lived Azure token (10 min)
┌────────▼──────────────── Supabase ────▼────────────────────────────────┐
│ Postgres + RLS │ Storage (private) │ Auth (magic link)                  │
│ Edge Functions: azure-token · ai                                        │
└────────┬──────────────────┬───────────────────────────────────────────┘
         ▼                  ▼
   Azure Speech        Gemini API
   (token endpoint)    (text + audio)
```

**Core loop (after each recording):**
1. Browser records → Azure returns scores per word/phoneme.
2. Browser computes derived metrics (WPM, pauses, fillers).
3. Audio + attempt + word results saved (one RPC).
4. `ai` function sends a compact summary to Gemini → structured feedback JSON.
5. UI shows colored words + scores immediately; AI feedback card appears when ready.

---

## 4. Tech Stack

**Frontend:** React, Vite, TypeScript (strict), Tailwind CSS, React Router (`HashRouter`), TanStack Query, Zustand (recording/session state), Recharts, JSZip (PPTX parsing), `microsoft-cognitiveservices-speech-sdk`, `vite-plugin-pwa`, `@supabase/supabase-js`, Vitest.

**Backend:** Supabase Edge Functions (Deno/TypeScript), Postgres, Storage, Auth (email magic link, single user).

Pin exact versions in Sprint 0 (check current stable releases).

---

## 5. Functional Modules

### 5.1 Lecture & Script Studio
- **Create lecture:** title, audience, target duration (minutes), optional `.pptx`.
- **PPTX import (client-side, JSZip):**
  - Slide order from `ppt/presentation.xml` + `ppt/_rels/presentation.xml.rels`.
  - Slide text: all `<a:t>` runs in `ppt/slides/slideN.xml` (first title placeholder → slide title).
  - Speaker notes: `ppt/notesSlides/notesSlideN.xml` (resolve via slide rels).
  - Hidden slides (`show="0"`) are skipped. Decks built without placeholders get the short text in the largest font (topmost on a tie) as title. Footers repeated on most slides and bare slide numbers are dropped from the slide text.
  - The speaker notes become each slide's first script, split into sentences (`import_slides` RPC, one transaction).
- **Intent notes per slide:** what the user wants to say, in Hebrew or English.
- **AI script drafting:** per slide, from slide text + notes + intent + time budget → spoken American English script.
- **Discussion chat:** per lecture, optionally scoped to a slide. User may write in Hebrew. AI can return a `proposed_edit` the user accepts or rejects.
- **"Americanize" action** on any text: revised text + list of changes with Hebrew reasons (shown as a diff).
- **Segmentation:** each slide's script split into sentences = practice units. Editable (merge/split/reorder).
- **Estimates:** word count and speaking time per slide at 140 WPM vs target duration.

### 5.2 Reference Audio
- Generated **in the browser** with the Speech SDK `SpeechSynthesizer` (token auth, `audioConfig = null` → `result.audioData`), then uploaded to Storage.
- Two variants per sentence: normal and slow (SSML `<prosody rate="-25%">`), generated on demand.
- Cache key: `sha256(text | voice | rate)` → skip synthesis if the file exists.
- Capture `wordBoundary` events → `sentences.ref_word_timings` → highlight words during playback.
- Single-word references (for the "compare" sheet) and correction phrases (§5.7) use the same cache.
- Default voice set in settings (e.g. `en-US-AndrewNeural`; verify availability in the chosen region).

### 5.3 Recording & Assessment (core)
**Capture**
- `getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })` — test with noise suppression on/off in Sprint 2 and keep what scores more consistently.
- AudioWorklet downsamples to 16 kHz PCM16 mono and feeds two sinks:
  - Speech SDK `PushAudioInputStream` with `AudioStreamFormat.getWaveFormatPCM(16000, 16, 1)`.
  - WAV encoder for playback and storage.
- iOS: start the `AudioContext` inside the record-button tap handler.

**Assessment config (Speech SDK, `en-US`)**
```ts
const pa = new sdk.PronunciationAssessmentConfig(
  referenceText,
  sdk.PronunciationAssessmentGradingSystem.HundredMark,
  sdk.PronunciationAssessmentGranularity.Phoneme,
  true // enableMiscue
);
pa.enableProsodyAssessment = true;
pa.phonemeAlphabet = "IPA";
pa.nbestPhonemeCount = 5; // "what was actually said" per phoneme
```
- Sentence mode (≤ ~30 s): `recognizeOnceAsync`.
- Slide / full-run mode: continuous recognition; aggregate all segment results.

**Result mapping**
- Utterance: `PronScore`, `AccuracyScore`, `FluencyScore`, `CompletenessScore`, `ProsodyScore`.
- Words: `Word`, `Offset`, `Duration` (100-ns ticks → ms), `AccuracyScore`, `ErrorType` (`None | Mispronunciation | Omission | Insertion | UnexpectedBreak | MissingBreak | Monotone`), `Phonemes[]` with `AccuracyScore` and `NBestPhonemes`.
- Keep the raw JSON in `attempts.azure_raw` for re-analysis.

**Derived metrics (pure functions, unit-tested)**
- WPM = spoken words ÷ (last word end − first word start) × 60.
- Pauses: gaps > 0.5 s (short) and > 1.5 s (long) → counts + longest.
- Fillers: `um, uh, er, ah, like, you know` — from insertions + recognized text. **Verify in Sprint 2 how Azure reports disfluencies.**
- Color bands: ≥ 85 green · 60–84 amber · < 60 red.

**Persistence:** upload WAV → `recordings/{user_id}/{attempt_id}.wav`; then `save_attempt` RPC inserts the attempt, word results and updates weak items in one transaction.

**Quota guard:** before recording, read `v_month_usage`. Warn at 80% of the monthly Azure minutes, block at 98% with a clear message. Queue requests (F0 allows 1 concurrent).

### 5.4 AI Feedback (after each recording)
**Input to Gemini** (`ai` function, action `feedback`): reference text, recognized text, utterance scores, the worst ≤ 8 words with phoneme details (expected phoneme + top N-best = what was heard), prosody flags, derived metrics, the user's top 5 weak sounds. For slide/full-run modes optionally attach compressed audio for tone/energy/intonation comments.

**Output (structured JSON via `responseSchema`):**
```json
{
  "summary_he": "2–3 sentences",
  "score_comment_he": "string",
  "issues": [
    {
      "word": "theory",
      "type": "phoneme | stress | linking | omission | pace | tone",
      "explanation_he": "string",
      "tip_he": "string",
      "say_it_like_en": "THEE-uh-ree",
      "ipa": "ˈθiːəri"
    }
  ],
  "drill_en": ["Three thin thinkers thought through the theory."],
  "next_step_he": "string"
}
```
- **Language rule:** explanations in Hebrew; words, respellings, examples and drills in English (rendered LTR).
- **Ground truth:** Gemini explains Azure's findings; it must not invent errors absent from the data. Max 3 issues, ordered by impact on intelligibility.
- **Failure mode:** on error/429 show Azure results anyway + "Retry feedback" button.

### 5.5 Practice UX
- **Sentence card:** English text · ▶ reference (normal / slow) · ● record · results.
- **Results:** colored words + score chips (Pronunciation, Accuracy, Fluency, Prosody).
- **Word sheet (tap a word):** play *your* slice (from Offset/Duration) vs the reference word · phoneme table (expected vs heard) · tip.
- **Modes:** Sentence → Slide (all sentences of a slide in one take) → Drill (weak items).
- **Shadowing:** play reference, then auto-start recording.
- **Drill queue:** weak items ordered by low score + least recently practiced; uses script sentences containing the word, or Gemini-generated drill sentences.

### 5.6 Progress
- **Dashboard:** Pronunciation score trend (daily avg) · Accuracy / Fluency / Prosody lines · minutes practiced per week · weakest sounds (phoneme avg accuracy) · weakest words · mastered count · Azure usage meter (minutes this month / cap).
- **Weak item rule:** after each attempt, every word with accuracy < 70 or `ErrorType ≠ None` is upserted (occurrences + 1, rolling average, last 5 scores). An item becomes `mastered` when its last 3 scores are ≥ 85.
- Phoneme stats come from `word_results.phonemes` via a SQL view.

### 5.7 Presentation Mode — Presenter View (MVP)

**Layout (desktop / tablet landscape).** Script column is always on the **right**, regardless of RTL UI.
```
┌─────────────────────────────────────────────────────────────────────┐
│ 5/19 · This is Max     ● Record take   ⏱ 03:12 ▶ ⟲   Plan 4:00–6:00   16:35 │
├───────────────────────────────────┬─────────────────────────────────┤
│ NOW ON SCREEN                     │ NEXT · 6 · One developer built… │
│                                   │ [ next slide thumbnail ]        │
│ [ current slide, ~60% width ]     ├─────────────────────────────────┤
│                                   │ SCRIPT (editable, memo level)   │
│                                   │ …                               │
│                                   │ ▍BEFORE YOU CLICK:              │
│                                   │ ▍"So where does this come from?"│
├───────────────────────────────────┴─────────────────────────────────┤
│ ← Back  Next →  · Memo L0–L4 · Revert slide · Export script · keys  │
└─────────────────────────────────────────────────────────────────────┘
```

**Header:** slide counter + title · "Record take" button · timer (total elapsed, Start/Pause/Reset) · planned window for the current slide · wall clock.

**Next slide:** thumbnail + number + title of the upcoming slide, so the transition is never a surprise.

**Transition line ("Before you click"):** one bridge sentence per slide that leads into the next slide, shown highlighted at the bottom of the script (`slides.transition_line`). Editable like the script; AI suggests one when drafting (Sprint 3).

**Timer & planned windows:**
- Planned duration per slide = script word count ÷ 140 WPM (at least 10 s per slide), scaled so the total equals `lectures.target_minutes`. Manual override: `slides.planned_seconds` (set on the lecture page, m:ss).
- Planned window = cumulative start–end for the slide (e.g. `Plan: 4:00–6:00`).
- Status color on the timer: green inside the window · amber up to 15 s past the end · red beyond · blue "ahead" when leaving a slide before its window starts.

**Inline editing:**
- Click the script (or press E) to edit; Esc or click outside saves (debounced autosave).
- On save, the slide script is re-segmented into `sentences` (`save_slide_script` RPC); unchanged sentences keep their ids so cached reference audio survives. A sentence edited in place keeps its id while it is still similar, and its audio is cleared. Line breaks are kept in `sentences.starts_paragraph`.
- "Revert slide" restores the slide's script as it was when the presenter view opened.
- "Export script" downloads a `.md` with every slide: title, script, transition line.

**Keyboard & clicker:** → / Space / PgDn next · ← / PgUp back · Home / End first/last · T start/pause timer · R start/stop take · M cycle memorization level · P peek · E edit · Esc exit edit / end take. Clickers send PgDn/PgUp. A hint bar shows the shortcuts.

**Phone:** portrait → slide top, script bottom, next slide via swipe; landscape → side by side. Swipe left/right to navigate.

**Memorization levels** (per slide, remembered): L0 full text · L1 every 3rd word blanked · L2 first letters only · L3 keywords only (3–6, chosen by Gemini, cached) · L4 no script. "Peek" shows the full text briefly.

**Slides source:** the owner uploads a PDF export of the deck; the browser renders each page with PDF.js at 1600 px (WebP where the browser encodes it, else PNG). Without images the view shows the slide title and text.

**Full-run rehearsal ("Record take"):** starts the timer and continuous recognition together, with the concatenated script as reference text; every slide change is timestamped. Stop (R) or Esc ends the take → upload → report.

**Run report** (a page per take, listed in the lecture's run history): total time vs target · time per slide vs planned window · WPM per slide (target band 130–160) · fillers per minute · long pauses · script coverage (omissions/insertions) · prosody/monotone flags · weakest words · Gemini delivery feedback (tone, energy, clarity) · **Corrections** (below).

**Corrections — "what sounds off to an American ear"**
- Source: Gemini **listens to the full-run audio** and flags whatever would sound wrong or unnatural to a native US listener: phrasing, grammar, word choice, pronunciation, stress, intonation. It judges by what it hears, not by the script or the transcript.
- Up to 8 items, ordered by how jarring they are.
- Card per item (phone: stacked; desktop: side by side):
```
 1 · Phrasing · Jarring
 ┌ What you said ─────────────┐ ┌ How Americans say it ──────┐
 │ to put AI into work        │ │ put AI to work             │
 │ ▶ You                      │ │ ▶ American                 │
 └────────────────────────────┘ └────────────────────────────┘
 Principle (Hebrew): direct translation mixes "put to work" and "put into practice".
```
- **▶ You:** plays the user's own audio slice. Anchoring: fuzzy-match `you_said_en` against Azure's word timeline within ±3 s of Gemini's approximate time; on a match (≥ 0.6) use Azure offsets + 150 ms padding, otherwise Gemini's times ± 0.5 s.
- **▶ American:** Azure TTS of `american_en` (same hash cache as §5.2).
- Each correction is saved with the take so "Practice this" can reuse it later (Sprint 4).

Long audio for Gemini: upload via the Gemini Files API in one call, with slide-change timestamps in the prompt (check current size and token limits; fallback: split per slide).

### 5.8 Coach Tips (from the owner's NotebookLM notebook)

The run report ends with **"Tips for the next take"**: 2–3 tips grounded in the owner's NotebookLM notebook (today: *Storytelling*, 8 TED/TEDx talks on delivery, storytelling, humor, self-introduction and practice). Tips appear only in the run report.

**Catalog:** `coach_tips` (§6), private to the owner. A tip has a slug, a category (`delivery` · `structure` · `humor` · `stage` · `practice` · `mindset`), triggers, a rotating flag, a Hebrew title and body, an optional English example (an original line, not a quote) and its sources (speaker, talk, URL). The first import has 44 tips; the working copy lives in `private/coach-tips/` (gitignored).

**Import ("עדכן טיפים"):** done by Claude, not the app.
1. Read the notebook with the NotebookLM CLI: the full text of each source, plus grounded questions per category.
2. Distill the tips and check each one against its source text.
3. Show the owner the changes.
4. After approval, upsert by slug.

The app never calls NotebookLM.

**Triggers** (draft thresholds are kept with the catalog; calibrate them on real takes):

| Detected from | Triggers |
|---|---|
| Metrics (§5.3, §5.7) | `pace_fast` · `pace_slow` · `few_pauses` · `long_pauses` · `fillers` · `overtime` · `slide_overrun` · `long_intro` |
| Azure / script alignment | `monotone` · `low_coverage` |
| Transcript counts | `and_heavy` (many "and", few "but") · `low_you` (little direct address) |
| Run history | `first_run` · `repeat_issue` · `many_issues` |
| Gemini (listening) | `low_energy` · `flat_emotion` · `no_hook` · `no_key_point` · `no_story` · `weak_ending` |

**Selection (rules, shown at once):** `selectTips(issues, catalog, recentSlugs)` is a pure, unit-tested function.
1. Detect the issues and rank them by severity. Keep the top 3.
2. Pick one tip per issue from the tips whose triggers match. Skip a tip shown in the last 5 takes when another one fits.
3. Every card shows the measured evidence, e.g. "172 WPM on slides 4–6 (target 130–160)".
4. With fewer than 3 issues, add one rotating tip labeled "עוד טיפ מהמחברת". These cover body language, humor and mindset, which the app does not measure.

**AI layer:** `run_report` receives the selected tips (slug, trigger, evidence) and the catalog index (slug, title, triggers).
- It anchors each selected tip to one moment in the take: the slide, the approximate time and what was said. It adds a personal Hebrew line.
- It may add up to 2 tips for what only listening reveals (the Gemini triggers above). It uses a catalog slug when one fits. Otherwise the tip has `from_notebook: false` and is shown as "הצעה כללית, לא מהמחברת".
- Unknown slugs are dropped.

**Fallback:** if Gemini fails or its quota is used up, the rule tips stay, and a "נסה שוב" button re-requests the AI layer. If the catalog is empty, only AI tips show, all labeled as general.

**Card:** title · body · evidence chip · English example (LTR) · source link ("מתוך: speaker — talk", opens YouTube). Latin text inside Hebrew fields is wrapped LTR. The tips are saved with the take: rule tips in `attempts.metrics.tips`, AI tips in `attempts.ai_feedback.tips`.

---

## 6. Data Model (Postgres)

```sql
create table lectures (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title         text not null,
  audience      text,
  target_minutes int,
  pptx_path     text,
  status        text not null default 'draft'
                check (status in ('draft','practicing','ready','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table slides (
  id            uuid primary key default gen_random_uuid(),
  lecture_id    uuid not null references lectures(id) on delete cascade,
  position      int not null,
  title         text,
  source_text   text,        -- extracted from PPTX
  source_notes  text,        -- PPTX speaker notes
  intent_notes  text,        -- what the user wants to say (any language)
  image_path    text,        -- rendered slide PNG
  transition_line text,      -- "Before you click" bridge sentence
  planned_seconds int,       -- manual override; null = computed
  keywords      text[],      -- memorization level L3
  memo_level    int not null default 0,
  unique (lecture_id, position)
);

create table sentences (
  id               uuid primary key default gen_random_uuid(),
  lecture_id       uuid not null references lectures(id) on delete cascade,
  slide_id         uuid references slides(id) on delete cascade,
  position         int not null,
  text             text not null,
  starts_paragraph boolean not null default false,  -- keeps the author's line breaks
  original_text    text,     -- before "Americanize"
  change_notes     jsonb,    -- [{from, to, reason_he}]
  ref_voice        text,
  ref_audio_path   text,
  ref_audio_slow_path text,
  ref_word_timings jsonb,    -- [{word, offset_ms, duration_ms}]
  updated_at       timestamptz not null default now()
);

create table chat_messages (
  id            uuid primary key default gen_random_uuid(),
  lecture_id    uuid not null references lectures(id) on delete cascade,
  slide_id      uuid references slides(id) on delete set null,
  role          text not null check (role in ('user','assistant')),
  content       text not null,
  proposed_edit jsonb,       -- optional structured edit proposal
  created_at    timestamptz not null default now()
);

create table attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lecture_id       uuid references lectures(id) on delete set null,
  slide_id         uuid references slides(id) on delete set null,
  sentence_id      uuid references sentences(id) on delete set null,
  mode             text not null check (mode in ('sentence','slide','drill','full_run','free')),
  reference_text   text,
  recognized_text  text,
  audio_path       text,     -- null after retention cleanup
  duration_sec     numeric not null,
  pron_score numeric, accuracy numeric, fluency numeric,
  completeness numeric, prosody numeric,
  wpm numeric, filler_count int, long_pause_count int,
  metrics          jsonb,    -- pauses, per-slide timings, etc.
  azure_raw        jsonb,
  ai_feedback      jsonb,
  created_at       timestamptz not null default now()
);

create table word_results (
  id          bigint generated always as identity primary key,
  attempt_id  uuid not null references attempts(id) on delete cascade,
  position    int not null,
  word        text not null,
  accuracy    numeric,
  error_type  text,
  offset_ms   int,
  duration_ms int,
  phonemes    jsonb           -- [{phoneme, accuracy, nbest:[{phoneme, score}]}]
);

create table weak_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind              text not null check (kind in ('word','phoneme')),
  value             text not null,
  occurrences       int not null default 0,
  avg_accuracy      numeric,
  recent_scores     numeric[] not null default '{}',  -- last 5
  status            text not null default 'active' check (status in ('active','mastered')),
  last_seen_at      timestamptz,
  last_practiced_at timestamptz,
  unique (user_id, kind, value)
);

create table user_settings (
  user_id              uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  voice                text not null default 'en-US-AndrewNeural',
  slow_rate            text not null default '-25%',
  send_audio_to_llm    boolean not null default true,   -- needed for corrections; user can turn off
  privacy_ack          boolean not null default false,
  azure_minutes_cap    int not null default 300
);

create table coach_tips (                          -- §5.8, imported from NotebookLM
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slug          text not null,
  category      text not null
                check (category in ('delivery','structure','humor','stage','practice','mindset')),
  triggers      text[] not null default '{}',
  rotating      boolean not null default false,    -- may fill the report without a trigger
  title_he      text not null,
  body_he       text not null,
  example_en    text,
  sources       jsonb not null default '[]',       -- [{speaker, title, event, url}]
  active        boolean not null default true,
  updated_at    timestamptz not null default now(),
  unique (user_id, slug)
);
```

**RLS:** enabled on every table. Tables with `user_id` → `user_id = auth.uid()`. Child tables (`slides`, `sentences`, `chat_messages`, `word_results`) → `exists` check against the owning `lectures` / `attempts` row.

**Indexes:** `attempts(user_id, created_at desc)` · `word_results(attempt_id)` · `sentences(lecture_id, position)` · `slides(lecture_id, position)` · `weak_items(user_id, status)`.

**Views:** `v_daily_progress` (avg scores per day) · `v_phoneme_stats` (avg accuracy per phoneme, last 30 days) · `v_month_usage` (sum of `duration_sec` this month).

**RPC** (all `security invoker`):
- `import_slides(p_lecture_id, p_slides jsonb)` — a new deck's slides and their first sentences, in one transaction.
- `save_slide_script(p_slide_id, p_sentences jsonb)` — replaces a slide's sentences with an ordered list; an `id` keeps that sentence, `null` inserts one.
- `save_attempt(payload jsonb)` — inserts attempt + word results and upserts weak items atomically.

**Storage (all private, signed URLs):**
- `recordings/{user_id}/{attempt_id}.wav`
- `reference-audio/{user_id}/{sha256}.mp3`
- `pptx/{user_id}/{lecture_id}.pptx`
- `slides/{user_id}/{lecture_id}/{n}-{version}.webp|png` (a new version per render, so a re-render never comes back from a stale cache)

**Retention (free-tier storage):** WAV at 16 kHz mono ≈ 1.9 MB/min. A scheduled job keeps audio for the last 5 attempts per sentence and full runs from the last 60 days; older audio files are deleted, scores are kept (`audio_path = null`).

---

## 7. API Contracts (Edge Functions)

All functions require the user's Supabase JWT, checked in code by `_shared/auth.ts` (functions deploy with `verify_jwt = false`; see Appendix B). Secrets via `supabase secrets set`.

### `azure-token`
`GET` → `{ token, region, expiresAt }`
Calls `https://{AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken` with header `Ocp-Apim-Subscription-Key`. Token is valid ~10 minutes; the client refreshes at 9 minutes. Used for both assessment and TTS via `SpeechConfig.fromAuthorizationToken(token, region)`.

### `ai`
`POST { action, payload }` → JSON. One function with an action router.

| Action | Payload | Returns |
|--------|---------|---------|
| `draft_script` | lecture meta, slide `{source_text, source_notes, intent_notes}`, `target_seconds` | `{ script_en, sentences[], notes_he }` |
| `americanize` | `{ text }` | `{ text_en, changes: [{from, to, reason_he}] }` |
| `chat` | lecture + slide context, history, message | `{ reply, proposed_edit? }` |
| `feedback` | see §5.4 | feedback JSON (§5.4) |
| `keywords` | `{ slide_script }` | `{ keywords[] }` |
| `run_report` | full-run audio (Files API), script, slide timestamps, metrics, per-slide data, weak words, selected tips + catalog index (§5.8) | `{ summary_he, strengths_he[], improvements[], next_session_plan_he, corrections[], tips[] }` |

Implementation: Gemini REST with `system_instruction`, `responseMimeType: "application/json"` + `responseSchema`; model from `GEMINI_MODEL`; retry 429/5xx with exponential backoff (max 2 retries); on failure return `503 { message_he }`. Audio only when `user_settings.send_audio_to_llm = true` (without audio the report has no Corrections section).

`corrections[]` item schema:
```json
{
  "category": "phrasing | grammar | word_choice | pronunciation | stress | intonation",
  "severity": "jarring | minor",
  "you_said_en": "to put AI into work",
  "american_en": "put AI to work",
  "principle_he": "string",
  "slide": 5,
  "approx_start_sec": 132.4,
  "approx_end_sec": 134.1
}
```
Prompt rule for corrections: "Listen as a native American listener. Quote exactly what was said. Flag only what a US listener would notice. Judge by the audio, not the script."

`tips[]` item schema (§5.8; `title_he` and `body_he` only when `slug` is null):
```json
{
  "slug": "pause-before-key",
  "from_notebook": true,
  "trigger": "pace_fast",
  "slide": 5,
  "approx_start_sec": 132.4,
  "said_en": "and the valve was the real problem",
  "personal_he": "string",
  "example_en": "string",
  "title_he": null,
  "body_he": null
}
```
Prompt rule for tips: "Anchor every tip to one moment you heard. Use only slugs from the catalog for notebook tips. Never present your own advice as coming from the notebook."

---

## 8. Prompts (initial drafts)

Store in `supabase/functions/ai/prompts/` and version them.

**Coach (system):**
> You are an American English presentation coach for a Hebrew-native engineer who presents technical topics. Write explanations in Hebrew. Write every English word, example, respelling and drill in English. Be concise, specific and honest; encourage without flattery. Use the Azure assessment data as ground truth — never invent errors that are not in the data. Report at most 3 issues, ordered by impact on intelligibility.

**Known Hebrew-speaker patterns (include as context):** /θ/ /ð/ → t, d, s, z · /w/ vs /v/ · American /ɹ/ vs Hebrew uvular r · /ɪ/ vs /iː/ (ship/sheep) · /æ/ vs /ɛ/ · schwa and vowel reduction · wrong word stress · final consonant clusters · flap t (water, better) · dark l.

**Americanize rules:** natural spoken style · contractions where natural · ≤ 20 words per sentence · remove Hebrew calques (e.g. "It's worth to check" → "It's worth checking"; "open the computer" → "turn on the computer") · keep technical terms exact · preserve the speaker's meaning · explain each change in Hebrew.

**Script drafting rules:** write for the ear, not the eye · one idea per sentence · signpost transitions ("Now let's look at…") · fit the time budget at 140 WPM · avoid words that are hard for Hebrew speakers when a simpler synonym exists, unless it's a required technical term.

---

## 9. Non-functional Requirements

- **Latency:** assessment result ≤ 3 s after stop for a ≤ 15 s sentence.
- **Offline:** app shell cached; recording needs network — show a clear offline state.
- **Privacy:** one-time notice that Gemini free tier may use submitted data; avoid confidential work content; full-run audio goes to Gemini by default (needed for Corrections); a settings toggle turns it off.
- **Security:** no keys in the client · RLS on all tables · JWT on all functions · signed URLs for audio.
- **i18n:** UI `dir="rtl"` Hebrew; English content `dir="ltr" lang="en"`.
- **Accessibility:** record button ≥ 64 px · shortcuts: R = record/stop, Space = play reference, ← / → = previous/next.
- **Mobile:** HTTPS + user gesture for mic; verify mic inside the **installed** PWA on iPhone during Sprint 2.

---

## 10. Free-Tier Budget (verify all limits in Sprint 0)

| Service | Free allowance (Sep 2026) | Expected use | Guard |
|---------|---------------------------|--------------|-------|
| Azure STT + Pronunciation Assessment (F0) | 5 audio hours/month · 1 concurrent · stops (no billing) at quota | ~10 s per sentence attempt → hundreds of attempts + a few full runs | usage meter; warn 80%, block 98% |
| Azure Neural TTS (F0) | 0.5M characters/month | 15-min script ≈ 12k chars × 2 variants | hash cache |
| Gemini API (free tier) | per-model RPM / RPD limits | 1 call per attempt | backoff + retry button |
| Supabase (free) | project count, DB/storage caps, pause on inactivity | audio is the main storage | retention job |
| Gmail SMTP (login emails) | ~500 emails/day | a few per week | Auth rate limit 30/hour |
| GitHub Pages | free | static hosting | — |

---

## 11. Build Plan (Sprints)

For each sprint: plan → approval → build → demo checklist → update Status in `CLAUDE.md`.

**MVP = Sprints 0–2:** presenter view + full-run recording + run report. Sentence-level drilling comes after.

### Sprint 0 — Setup
**Prerequisites (user):** Azure account + Speech resource F0 · Gemini API key · Supabase project (new, or an existing one if the free project limit is reached) · GitHub repo. See Appendix A.
**Tasks:** scaffold Vite + React + TS + Tailwind · RTL layout (bottom nav on mobile, sidebar on desktop) · Supabase client + magic-link auth · all migrations + RLS + views · GitHub Actions deploy to Pages · PWA manifest and icons · set secrets · `azure-token` function.
**Acceptance:** login works on phone and desktop · deployed URL live · `azure-token` returns a token when logged in and 401 otherwise.

### Sprint 1 — Lecture import + Presenter view (MVP 1/2)
**Tasks:** lectures CRUD · PPTX import (order, text, speaker notes → initial script) tested on 2 real decks · slide images from a PDF export (PDF.js) · presenter view per §5.7: current + next slide, script on the right, transition line, timer with planned windows and status colors, inline edit / revert / export, shortcuts + clicker + swipe, memorization levels L0–L2 and L4 · phone portrait/landscape layouts.
**Acceptance:** upload a real PPTX (+ its PDF export) → slides render → rehearse the whole deck (no recording yet) with timer, planned windows, next-slide preview, editing and memorization levels, on desktop and phone landscape.

### Sprint 2 — Full-run recording + Run report (MVP 2/2)
**Tasks:** AudioWorklet capture + WAV encoder · continuous pronunciation assessment with the concatenated script · slide-change timestamps · typed result parser + derived metrics (unit tests) · Storage upload + `save_attempt` (mode `full_run`) · `ai` function: `run_report` (audio via Files API, incl. corrections) + `keywords` (enables memorization L3) · basic TTS for correction phrases + cache · audio slicing with Azure/Gemini time anchoring · run report page per §5.7 incl. Corrections cards · run history per lecture · Azure usage meter · short spike report: filler detection, iOS installed-PWA mic, prosody availability in the region, noise suppression on/off, accuracy of Gemini timestamps.
**Acceptance:** rehearse a 10-slide deck end to end → report shows total and per-slide time vs planned windows, WPM, fillers, pauses, coverage, prosody, weakest words, AI feedback and Corrections cards where ▶ You and ▶ American both play the right phrase (or graceful fallback) · previous runs listed · tests pass.

### Sprint 2b — Coach tips in the run report
**Prerequisites:** Sprint 2 done · the owner has approved the tips draft (`private/coach-tips/`).
**Tasks:** `coach_tips` migration + RLS · import the approved catalog · issue detection + `selectTips` (unit tests) · transcript counts ("and" / "but", "you") · `run_report` tips input and `tips[]` output with validation · tip cards per §5.8 (evidence, example, source link, general-tip label) · rotation over the last 5 takes · calibrate thresholds on 3+ real takes.
**Acceptance:** a take with a clear issue (e.g. fast pace) shows the matching notebook tip with its evidence at once · Gemini anchors it to a moment · with Gemini off or failing, the rule tips still show · general tips are labeled · tests pass.

### Sprint 3 — Script Studio + reference audio
**Tasks:** slide intent notes · `ai` actions `draft_script` (script + transition line), `americanize`, `chat` · diff view with Hebrew reasons · sentence segmentation editor · TTS per sentence normal/slow + word highlighting (extends the Sprint 2 TTS) · voice setting.
**Acceptance:** import a deck → AI drafts script and transition lines for all slides → refine via chat → every sentence has playable reference audio (normal and slow) → changes appear in the presenter view.

### Sprint 4 — Sentence practice, AI feedback, progress
**Tasks:** sentence practice (`recognizeOnceAsync`) + colored words + score chips · word sheet (phonemes, own-audio slice vs reference) · shadowing · `feedback` action + feedback card (Hebrew with LTR English) · "Practice this" links from the run report's weakest words · weak-items drill · progress dashboard (Recharts) · retention cleanup job.
**Acceptance:** sentence result in ≤ 3 s on iPhone (installed PWA) and desktop · feedback after each recording (or graceful fallback) · weak words update · dashboard shows trends across ≥ 3 days (seed data for dev).

### Backlog (revisit as the app grows)
Claude API as an alternative `LlmProvider` · compressed audio storage (Opus) · spaced-repetition scheduling for weak items · exportable progress report · self-hosted scoring on a VPS if Azure limits become a problem · automatic PPTX → images (LibreOffice on a VPS) if the PDF export step gets tedious.

---

## 12. Repository Structure

```
lecture-coach/
├─ CLAUDE.md
├─ docs/ARCHITECTURE.md
├─ src/
│  ├─ app/              # routes, layout, auth guard
│  ├─ features/
│  │  ├─ lectures/  script/  practice/  present/  progress/  settings/
│  ├─ audio/            # capture worklet, WAV encoder, slicing
│  ├─ speech/           # token client, assessment, TTS, result parser
│  ├─ providers/        # SpeechProvider, LlmProvider + azure/gemini impl
│  ├─ lib/              # supabase client, metrics, pptx parser
│  └─ components/       # shared UI
├─ public/              # icons, audio-worklet processor
├─ supabase/
│  ├─ migrations/
│  └─ functions/ azure-token/ ai/
├─ private/             # gitignored: coach-tips working copy (§5.8)
└─ .github/workflows/deploy.yml
```

---

## 13. Environment Variables

**Client (`.env`):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable key).

**Supabase secrets:** `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `GEMINI_API_KEY`, `GEMINI_MODEL`.

---

## 14. Open Items to Verify

1. How Azure reports filler words / disfluencies (Sprint 2).
2. Microphone inside the installed iOS PWA (Sprint 2).
3. Prosody assessment support for en-US in the chosen Azure region (Sprint 0).
4. Current Gemini free-tier models, limits and audio size limits (Sprint 0).
5. Supabase free-tier limits: project count, storage, inactivity pausing (Sprint 0).
6. Availability of the default voice in the region (Sprint 2).
7. Accuracy of Gemini audio timestamps for correction slicing (Sprint 2).
8. Thresholds for the tip triggers: calibrate on real takes (Sprint 2b).

---

## Appendix A — Account Setup (Sprint 0)

Portal names change often; if a label differs, search for "Speech".

**Azure Speech (F0)**
1. Sign up at azure.microsoft.com (a card is required for identity verification).
2. Portal → *Create a resource* → search **Speech** → *Create*.
3. Fill in: subscription · new resource group `lecture-coach-rg` · region (one that supports pronunciation assessment with prosody for en-US) · name · **Pricing tier: Free F0**.
4. After deployment → *Keys and Endpoint* → copy **Key 1** and **Region**.
5. `supabase secrets set AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=...`
6. If Azure later asks to upgrade the subscription, the F0 resource itself still does not bill — it only throttles at the quota.

**Gemini**
1. aistudio.google.com → *Get API key* → create a key.
2. `supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=<current Flash model>`

**Login emails (Gmail SMTP)**
1. myaccount.google.com/apppasswords → create an app password named `Supabase lecture-coach`.
2. Dashboard → *Authentication* → *Emails* → *SMTP Settings* → enable custom SMTP:
   - host `smtp.gmail.com`, port `465`, minimum interval `60`;
   - username and sender email: the owner's Gmail address;
   - password: the app password.
3. `supabase config diff` → review → `supabase config push` (sends the Hebrew templates from `supabase/templates/`).

---

## Appendix B — Verified in Sprint 0 (September 2026)

- **Supabase free plan:** 2 active projects · 500 MB database · 1 GB storage · **50 MB max per upload** · pauses after ~7 days without database activity → `keep-supabase-awake` workflow calls `public.ping()` three times a day (no emails).
- **Edge Functions auth:** the platform `verify_jwt` check lets the publishable key through and does not understand this project's ES256 user sessions. Functions deploy with `verify_jwt = false` and call `requireUser()` (`supabase/functions/_shared/auth.ts`), which validates the session with Supabase Auth.
- **Login email:** carries both a magic link (desktop) and a 6-digit code (installed iOS PWA, where links open in Safari instead of the app). It is sent through the owner's Gmail (custom SMTP). On the free plan, the built-in email service rejects custom templates, and it sends only 2 emails per hour. With custom SMTP, the limit is 30 per hour.
- **`config push`:** writes every property `config.toml` declares, email template bodies included. Template defaults that differ from the hosted project are commented out and marked "Hosted default". SMTP stays undeclared, because its password lives only in the Dashboard. Run `supabase config diff` before every push.
- **Azure pronunciation assessment:** audio longer than 30 s needs continuous mode, where `enableMiscue` is not supported → Sprint 2 computes omissions/insertions by aligning recognized words with the script. Prosody is en-US only (SDK ≥ 1.35).
- **PDF.js:** the modern build needs `Map.prototype.getOrInsertComputed`, which older Chromium (141) and Safari lack → the app uses the legacy build (Sprint 1).
- **Gemini:** latest free-tier Flash model is `gemini-3.8-flash` (text/image/video/audio/PDF input, 1M-token context). Rate limits are per account and shown only in AI Studio.
