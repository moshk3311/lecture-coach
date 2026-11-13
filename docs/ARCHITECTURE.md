# Lecture Coach — Architecture

Version 2.0 (lean) · November 2026

A personal app for one person who is preparing to give a lecture in English. It does two jobs: rehearse in front of the slides, and record a full take and get AI feedback on it. This document describes only what exists in the code. The earlier, much larger plan is archived in `docs/ARCHITECTURE-v1-full.md` (code: git tag `full-scope-v1`); see §12.

---

## 1. Context & Goals

**User:** one person, Hebrew-native, presents technical topics in English. Rehearses on desktop and phone.

| # | Goal |
|---|------|
| G1 | **Rehearse** in front of the slides: slide, script, a timer with planned windows per slide, memorization levels. |
| G2 | **Record a full take** and get a run report: time per slide against the plan, the recording, Gemini's delivery feedback and "Corrections" (what sounds off to an American ear), coach tips. |
| G3 | Script help that already works: a draft per slide ("✎ הצע מלל"), an "Americanize" pass ("תקן לאמריקאית"), and word / speaking-time estimates per slide. These are not extended. |

**Non-goals:** multiple users · feedback while speaking (it comes after the take) · editing PowerPoint files · video or body-language analysis · pronunciation scoring · per-sentence practice and progress tracking (cut, §12).

**Constraints:** zero running cost (free tiers only; nothing is ever enabled that can bill) · single user · input is a PPTX plus a PDF export of the same deck · Hebrew RTL UI, all English content wrapped in `dir="ltr" lang="en"`.

---

## 2. Key Decisions & Trade-offs

| Area | Choice | Why | Trade-off |
|------|--------|-----|-----------|
| LLM | Gemini API, free tier, through the `ai` Edge Function | Free; understands audio natively. | Rate limits. Free-tier data may be used by Google, so no confidential material. The model name is a secret (`GEMINI_MODEL`), since names change. |
| What Gemini listens to | The raw recording, not a transcript | A transcript can silently "fix" errors; listening catches phrasing, grammar, pronunciation and intonation as a US listener hears them. | Gemini's timestamps are approximate. Audio is sent to Google (the owner can turn this off, §8). |
| Pronunciation scoring | **None. Azure was dropped.** | Signup was blocked (2026-10-01) and the owner cut the scope. | No measured pace, pauses, fillers or pronunciation scores. Gemini reports what it hears, in words, without numbers. |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) | Keeps the API key server-side; RLS. | Free-tier caps (§9). |
| Hosting | GitHub Pages, `HashRouter` | Free. Pages serves one `index.html`, so routes live in the hash. | None that matter. |
| Slide images | The owner uploads a PDF export of the deck; PDF.js renders it in the browser | No server, no cost; the PDF is the most faithful rendering. | One extra export step per deck. |
| Feedback timing | After the take, never live | Simpler, more accurate, cheaper. | No live cues while speaking. |
| Provider interfaces | `LlmProvider` and `ReferenceVoice` in `src/providers/` | The app never calls Gemini directly; swapping the model happens behind the `ai` function. | Slight upfront structure. |
| Coach tips | From the owner's NotebookLM notebook, imported by Claude on request into the private `coach_tips` table | Tips come from talks the owner chose; rules pick them from measured times, so they show even when Gemini fails. | The app cannot read NotebookLM, so catalog updates are manual. Tip content lives only in the DB, never in this public repo. |
| American voice | Gemini TTS (`speak` action), cached in Storage | Same Gemini account, no extra service. | No word timings and no speed control; "slightly slow" is asked for in the prompt. |

---

## 3. System Overview

```
┌──────────── PWA (React + Vite + TS, GitHub Pages) ─────────────┐
│  Lectures │ Lecture page │ Presenter view │ Run report │ Settings │
│                                                                 │
│  Mic → AudioWorklet → PCM16 / 16 kHz / mono ──► WAV blob        │
│  PDF.js: PDF export → slide images                              │
└───────┬─────────────────────────────────────────────────────────┘
        │ supabase-js (user JWT)
┌───────▼──────────────────── Supabase ───────────────────────────┐
│ Postgres + RLS │ Storage (private) │ Auth (email link / code)    │
│ Edge Function: ai (action router)                                │
└───────┬─────────────────────────────────────────────────────────┘
        ▼
   Gemini API (text, image, audio via Files API, TTS)
```

**Core loop of a take:**
1. In the presenter view, "Record take" (or `R`) starts the timer and the recording together; every slide change is timestamped on the audio clock.
2. Stop ends the take. The WAV is uploaded and saved with its timing (one `save_attempt` call). The run report opens at once.
3. The app picks the rule-based coach tips from the take's times and the lecture's history, and saves them with the take.
4. After the one-time privacy notice, "בקש משוב" calls `run_report`: the function sends the recording and the facts to Gemini and saves the checked report in `attempts.ai_feedback`.
5. The page merges Gemini's tip anchors into the rule tips. A Gemini failure never hides what the app already shows.

---

## 4. Tech Stack

**Frontend:** React 19, Vite 8, TypeScript 6 (strict), Tailwind CSS 4, React Router 8 (`createHashRouter`), TanStack Query, JSZip (PPTX parsing), PDF.js (`pdfjs-dist`, legacy build), `lucide-react`, `vite-plugin-pwa`, `@supabase/supabase-js`. Fonts: Frank Ruhl Libre, IBM Plex Sans / Sans Hebrew / Mono.

**Tooling:** Vitest (jsdom), oxlint, Node 24, Supabase CLI as a dev dependency. GitHub Actions: `ci.yml` (typecheck, lint, test, build on pull requests), `deploy.yml` (test, lint, build, publish to Pages on push to `main`), `keep-supabase-awake.yml` (§9).

**Backend:** one Supabase Edge Function (Deno/TypeScript), Postgres, Storage, Auth (email magic link plus 6-digit code, single user).

---

## 5. Functional Modules

### 5.1 Lectures & import
- **Lectures page** lists lectures; "new lecture" takes title, audience, target duration (minutes) and the deck. A lecture can be deleted for good (slides, scripts, images and recordings go with it).
- **PPTX import (client-side, JSZip):** slide order from `ppt/presentation.xml` and its rels; slide text from the `<a:t>` runs; speaker notes from `ppt/notesSlides`. Hidden slides are skipped. Decks without placeholders get the short text in the largest font as title; footers repeated on most slides and bare slide numbers are dropped. Speaker notes become each slide's first script, split into sentences. Saved in one transaction by the `import_slides` RPC. The original file goes to the `pptx` bucket.
- **Slide images:** the owner adds a PDF export (on the new-lecture page it can be picked or dropped together with the PPTX; the files are sorted by extension); PDF.js (legacy build, §9) renders page n as slide n at 1600 px width, as WebP where the browser encodes it, else PNG, into the `slides` bucket. A re-render uses a new file name (no stale cache) and removes the old files. Without images the presenter shows the slide title and text.
- **Planned time:** each slide may carry a manual `planned_seconds` (set on the lecture page as m:ss); otherwise it is computed (§5.3).

### 5.2 Script help (not extended)
- **Script storage:** a slide's script is its `sentences` rows (text, position, `starts_paragraph`). Saving a script re-splits it into sentences (`splitScript` / `resegment` in `src/lib/script.ts`) and calls `save_slide_script`; unchanged sentences keep their ids.
- **Draft ("✎ הצע מלל"):** per slide, the `draft_script` action takes the slide picture (when the deck has images), its text and speaker notes, the speaker's intent notes (Hebrew or English), the slide's time budget and the neighbouring slides, and returns spoken American English, a bridge sentence into the next slide and Hebrew notes. It is a proposal shown next to the current script; the owner accepts or refuses. "Draft every slide without a script" fills empty slides one after another and marks them for review.
- **Americanize ("תקן לאמריקאית"):** per slide with a script, the `americanize` action returns a revised script and bridge sentence plus a list of changes, each with a Hebrew reason. Shown as a word diff (`src/lib/wordDiff.ts`); accepted or refused. Nothing is saved until accepted, and the change notes are not stored.
- **Estimates:** on the lecture page, words and speaking time per slide at 140 WPM next to the planned time (red when more than 15% over, amber when more than 15% and 10 s under), and the total against the lecture's target.

### 5.3 Presenter view
Full screen at `/present/:lectureId`, outside the app shell. It is opened from the lecture page.

**Layout.** Wide screens and landscape: the current slide on one side, and next-slide thumbnail, script and "Before you click" line on the other. Phone portrait: slide on top, script below; swipe left/right (at least 60 px, mostly horizontal) changes slide. The header shows slide counter and title, the "Record take" button, the timer and the planned window of the current slide.

**Timer & planned windows** (`src/features/present/plan.ts`):
- A slide's planned time is its manual `planned_seconds`, else its script words at 140 WPM (at least 10 s). When the lecture has a target duration, the computed slides are scaled so the total fills it; manual slides stay as set.
- Each slide's window is the cumulative start–end. The timer is blue ahead of the window, green inside it, amber up to 15 s past the end, then red.

**Inline editing.** Click the script (or `E`) to edit it; autosave 1.2 s after typing stops; `Esc` or a click outside closes. The "Before you click" line is editable the same way. "Revert slide" restores the script as it was when the view opened. "Export script" downloads a Markdown file with every slide's title, script and bridge line.

**Keyboard & clicker.** `→` / Space / PgDn next · `←` / PgUp back · Home / End first / last · `T` timer start/pause · `R` start/stop take · `M` cycle memorization level · `P` peek · `E` edit · `Esc` ends editing, or ends a running take. Letters use the physical key, so they work with a Hebrew layout. Clickers send PgDn / PgUp.

**Memorization levels** (per slide, remembered in `slides.memo_level`): L0 full text · L1 every third word blanked · L2 first letters only · L3 keywords only · L4 no script. "Peek" shows the full text briefly. L3 keywords (up to 6) come from the `keywords` action, are saved in `slides.keywords`, and are asked for again when an edit removes one of them. A slide without a script skips L3.

### 5.4 Take recording
- `getUserMedia` (mono, echo cancellation, noise suppression) into an AudioWorklet that produces 16 kHz PCM16 mono; the data becomes a WAV (`src/audio/`). The AudioContext starts inside the tap or key handler, as iOS requires.
- Every slide change is marked on the audio clock. The marks become visits and per-slide times (`src/lib/metrics.ts`).
- A take stops by itself just under the 50 MB upload limit (16 kHz mono WAV grows 32 kB per second; the cap is 1608 s, 26:48).
- **Saving:** upload to `recordings/{user_id}/{attempt_id}.wav`, then `save_attempt` (mode `full_run`, reference text = the concatenated script, `duration_sec`, `metrics` = the timing). A failed save deletes the uploaded file.
- **Retention:** after each saved take (and when a lecture is deleted) the app keeps the recordings of the newest 10 takes of existing lectures and deletes the rest. Reports and times stay (`audio_path = null`). Files are deleted before rows are cleared, so an interrupted cleanup finishes on the next take.

### 5.5 Run report
A page per take (`/lectures/:id/runs/:runId`), also listed in the lecture's run history. From top to bottom:
1. **Tiles:** total time against the target (green within 10%, amber, red beyond 20%) and the number of slides on track.
2. **Recording:** an audio player, or a note that the recording was deleted by retention.
3. **Time per slide:** actual against planned, with a status: on track (within ±20% of plan, at least ±10 s), long, short, or skipped.
4. **AI feedback & Corrections** (§5.6).
5. **Tips for the next take** (§5.7).

There are no speech measurements (pace, pauses, fillers, scores).

### 5.6 AI feedback & Corrections
- **Request:** a button in the report's AI section, after a one-time privacy notice (§8). The `run_report` action saves the report in `attempts.ai_feedback`; the page reads it from there. A failure shows the function's Hebrew message and a retry, and keeps any report already saved. "New feedback" asks again.
- **Content:** a short summary, up to 3 strengths, up to 3 delivery improvements (tone, energy, clarity, pace or structure, optionally tied to a slide), a plan for the next take, and **Corrections**.
- **Corrections** are what a native US listener would notice: phrasing, grammar, word choice, pronunciation, stress, intonation. Up to 8, jarring ones first. Gemini judges by the audio, not the script. Each card shows what was said, how an American says it, and a Hebrew principle. Without the recording there are no Corrections.
- **▶ You** plays the owner's own words. Gemini gives approximate start and end seconds; `anchorSpan` (`src/lib/anchor.ts`) widens them by 0.5 s each side and clamps to the take. Only those bytes are downloaded (an HTTP Range request on the WAV). Hidden when the recording was deleted or Gemini gave no time.
- **▶ American** plays the corrected phrase in Gemini TTS (§7 `speak`), cached in `reference-audio/{user_id}/{sha256}.wav`, keyed by the hash of text, voice and rate, so a phrase is synthesized once. When the free quota is spent the button is disabled and the report says why.

### 5.7 Coach tips
The run report ends with tips for the next take from the owner's notebook (*Storytelling*: TED/TEDx talks on delivery, storytelling, humor, practice). They appear only in the run report.

**Catalog:** `coach_tips`, private to the owner: slug, category (`delivery`, `structure`, `humor`, `stage`, `practice`, `mindset`), triggers, a rotating flag, Hebrew title and body, an optional English example, and sources (speaker, talk, URL). Imported by Claude on request after the owner approves; the app never calls NotebookLM. The working copy is in `private/coach-tips/` (gitignored).

**Triggers.** The contract (`supabase/functions/ai/contract.ts`) names 21; each tip lists the triggers it fits.

| Who detects | Triggers |
|---|---|
| Rules in the app (`src/lib/tips.ts`, from times and history) | `overtime` (total more than 10% over the target) · `slide_overrun` (a slide at least 15 s past its plan and marked long) · `long_intro` (first slide over 60 s) · `first_run` · `repeat_issue` (the previous take's top issue is back) · `many_issues` (4 or more measured issues; cannot fire while only three timing rules measure) |
| Gemini, from listening | `low_energy` · `flat_emotion` · `no_hook` · `no_key_point` · `no_story` · `weak_ending` |
| Gemini, speech habits it may also report | `pace_fast` · `pace_slow` · `few_pauses` · `long_pauses` · `fillers` · `monotone` · `and_heavy` · `low_you` |

`low_coverage` exists in the contract but nothing detects it now. The thresholds are drafts, not calibrated on real takes.

**Selection (`selectTips`, pure, unit-tested):** rank issues by severity; one tip per issue from the tips whose triggers match, at most 3; skip a tip shown in the last 5 takes when another fits; with fewer than 3, add one rotating tip labeled "עוד טיפ מהמחברת". Every rule tip carries its evidence in Hebrew (for example the slide's time against its plan).

**Where it runs:** the choice runs in the app when the report opens and is saved in `attempts.metrics.tips`. `run_report` reads those tips and the active catalog, and answers with `tips[]`: an anchor for each rule tip (slide, approximate time, the words said, one personal Hebrew line) plus at most 2 extras from listening. An extra uses a catalog slug when one fits; otherwise it has no slug, its own title and body, and is shown as "הצעה כללית, לא מהמחברת". Unknown slugs are dropped. Without the recording, only the rule tips are returned, with no anchors. Gemini's speech-habit reports carry no numbers, only the quoted moment.

**Fallback:** if Gemini fails, the rule tips stay and the AI retry asks again. If the catalog is empty, only Gemini's general tips can show.

---

## 6. Data Model (Postgres)

All tables have RLS (owner only). Storage buckets are private; the app uses signed URLs.

| Table | Used for |
|-------|----------|
| `lectures` | title, audience, `target_minutes`, `pptx_path`. |
| `slides` | per lecture: `position`, `title`, `source_text`, `source_notes`, `intent_notes`, `image_path`, `transition_line`, `planned_seconds`, `keywords` (L3), `memo_level`. |
| `sentences` | a slide's script: `text`, `position`, `starts_paragraph`. |
| `attempts` | full-run takes (`mode = 'full_run'`): `reference_text`, `audio_path` (null after retention), `duration_sec`, `metrics` (timing + `tips`), `ai_feedback` (the Gemini report). |
| `user_settings` | `send_audio_to_llm`, `privacy_ack`. A row is created for each new user. |
| `coach_tips` | the tip catalog (§5.7). |

**RPCs:** `import_slides(p_lecture_id, p_slides)`, `save_slide_script(p_slide_id, p_sentences)`, `save_attempt(p)` (updates or inserts an attempt by its client-generated id), `ping()` (keep-awake).

**Buckets:** `recordings` (`{user_id}/{attempt_id}.wav`), `reference-audio` (`{user_id}/{sha256}.wav`), `pptx` (the uploaded deck), `slides` (`{user_id}/{lecture_id}/{n}-{version}.webp|png`).

**Dormant, kept from the full plan:** the database was not changed by the lean-down and no migration was written. These stay empty and unused: tables `chat_messages`, `word_results`, `weak_items`; views `v_daily_progress`, `v_phoneme_stats`, `v_month_usage`; `attempts` columns `pron_score`, `accuracy`, `fluency`, `completeness`, `prosody`, `wpm`, `filler_count`, `long_pause_count`, `recognized_text`, `azure_raw`, `slide_id`, `sentence_id`; `sentences.ref_*`, `original_text`, `change_notes`; `user_settings.voice`, `slow_rate`, `azure_minutes_cap`; `lectures.status`. `save_attempt` still accepts the matching keys and word results.

---

## 7. The `ai` Edge Function

One function, `supabase/functions/ai`, with an action router. Request: `POST { action, payload }` with the user's JWT; response: the action's JSON. Every answer from Gemini is checked against a schema and normalized (`contract.ts`) before it is saved or returned. Calls retry up to twice (1 s, then 3 s) on 429 and 5xx. Any Gemini failure is a 503 with a Hebrew message; the app keeps what it has.

| Action | Input | Output |
|--------|-------|--------|
| `run_report` | `attempt_id` of a `full_run` take | The report: summary, strengths (≤3), improvements (≤3), plan for the next take, corrections (≤8), tips (≤5), `heard_audio`, model and prompt version. Reads the attempt, the lecture, `user_settings.send_audio_to_llm` and the active catalog. The WAV goes to Gemini through the Files API only while the setting is on and the file exists. Saved in `attempts.ai_feedback`. |
| `draft_script` | `slide_id`, optional `intent` (≤2000 chars) | `{ script_en, transition_line, notes_he, words, estimated_seconds, budget_seconds, saw_image, model, prompt_version }`. The slide image is sent inline when it is under 4 MiB. Nothing is saved. |
| `americanize` | `text`, `transition_line` | `{ text_en, transition_line, changes: [{ from, to, reason_he }] (≤12), model, prompt_version }`. Each change must quote text that was sent. Nothing is saved. |
| `keywords` | `slide_script` (≤6000 chars) | `{ keywords }`: up to 6, every word of each found in the script. |
| `speak` | `text` (≤300 chars), optional `voice` | `{ audio_base64, mime_type }`: a WAV from Gemini TTS (Interactions API). Voice defaults to `Kore`; 8 prebuilt voices are accepted. The app caches the file. |

Unknown action: 400. Missing secrets: 500. The function deploys with `verify_jwt = false` and `requireUser()` (`_shared/auth.ts`) does the real check (§8).

---

## 8. Non-functional Requirements

- **Privacy:** a one-time notice, shown in the report's AI section before the first request (`user_settings.privacy_ack`), says the Gemini free tier may use submitted data and to avoid confidential material. The recording goes to Gemini by default (Corrections need it). A switch in Settings, "שליחת אודיו ל-Gemini", turns it off; the report then has no Corrections.
- **Security:** no keys in the client (the Gemini key is a Supabase secret) · RLS on all tables · JWT checked on the function · signed URLs for audio and images.
- **Never block the core flow:** the presenter, the recording and the slide times work without Gemini.
- **i18n:** UI `dir="rtl"` Hebrew; English content in `dir="ltr" lang="en"` (the `En` component).
- **Mobile:** mobile-first, checked at 390 px and on desktop. The microphone needs HTTPS and a user gesture. A PWA, with an offline banner; recording needs the network to save.
- **Login:** the email carries a magic link (desktop) and a 6-digit code (the installed iOS PWA, where links open in Safari).

---

## 9. Free-Tier Budget

| Service | Free allowance | Use here | Guard |
|---------|----------------|----------|-------|
| Gemini API (free tier) | Per-model RPM / RPD limits, shown only in AI Studio; no billing account on the project | One call per feedback, draft, Americanize, L3 keywords or phrase voice | Retry with backoff, a retry button, Hebrew messages when the quota is spent |
| Supabase (free) | 2 active projects · 500 MB database · 1 GB storage · 50 MB per upload · pauses after about 7 days without database activity | Audio is the main storage: about 38 MB for a 20-minute take | Keep the newest 10 recordings (§5.4); the `keep-supabase-awake` workflow calls `ping()` three times a day |
| Gmail SMTP (login emails) | About 500 emails a day; Auth limit 30 an hour with custom SMTP | A few a week | — |
| GitHub Pages | Free | Static hosting | — |

**Verified limits and behavior:**
- Supabase project `lecture-coach` (`gzppgmoegcsdtovcdkmy`, eu-central-1).
- Edge Functions: the platform `verify_jwt` check does not understand this project's ES256 user sessions, so the function deploys with `verify_jwt = false` and validates the session itself.
- The built-in email service rejects custom templates and sends 2 emails an hour, so login emails go through the owner's Gmail.
- `supabase config push` writes every property `config.toml` declares; run `supabase config diff` first.
- PDF.js: the modern build needs `Map.prototype.getOrInsertComputed`, which older Chromium and Safari lack, so the legacy build is used.
- Storage CORS allows the `Range` header, so ▶ You downloads only its clip.
- Gemini: the free-tier Flash model (`gemini-3.8-flash` at the time of writing) takes text, image, audio and PDF input. Files uploaded through the Files API are deleted by Google after 48 hours.

---

## 10. Testing

- **Vitest unit tests** (`npm run test`): the PPTX parser, run timing metrics, plan windows, memorization levels, tip detection and selection, `anchorSpan`, audio (WAV, resampling, slicing), script segmentation, word diff, retention, and the `ai` contract (answer checks, prompts).
- **e2e** (`e2e/`, Playwright against the running dev server and an in-memory Supabase mock; a fake microphone feeds a tone; no login, nothing touches the real project). With `npm run dev` running, from `e2e/`:

| Command | Checks |
|---------|--------|
| `npm run screens` | Every screen at 390 px and on desktop (the presenter also in phone landscape); fails on sideways scroll, page errors or unmocked requests. |
| `npm run take` | A recorded take: saved attempt, WAV upload, slide timestamps, report, run history. |
| `npm run retention` | Keeps the newest 10 recordings; cleanup of deleted lectures and failed saves. |
| `npm run import -- <deck.pptx> [deck.pdf]` | Imports a real deck (test decks in `private/decks/`, gitignored). |
| `npm run ai` | Mocked `ai`: privacy notice, report with Corrections, ▶ You and ▶ American, failure and retry, the audio switch, L3 keywords. |
| `npm run tips` | Rule tips with evidence, Gemini anchors and extras, rotation, no section without a catalog. |
| `npm run draft` / `npm run americanize` | The two script helpers on the lecture page. |
| `npm run all` | `screens`, `take`, `retention`, `ai`, `tips`, `draft`, `americanize`. |

e2e uses a made-up tip catalog, never the real tips. Setup and details: `e2e/README.md`. CI runs typecheck, lint, tests and the build.

---

## 11. Environment Variables

**Client (`.env.local`):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the publishable key). The same two are GitHub repository variables for the Pages build.

**Supabase secrets** (`npx supabase secrets set KEY=value`): `GEMINI_API_KEY`, `GEMINI_MODEL`; optional `GEMINI_TTS_MODEL` (overrides the default TTS model `gemini-3.8-flash-tts`).

---

## 12. Cut on 2026-11-10 and why

The owner decided to cut the app to the two jobs above and freeze it until after the lecture. Removed from the code:
- **Azure Speech entirely:** pronunciation assessment, word and phoneme scores, WPM / pauses / fillers / coverage measurements, weak words, the usage meter and quota guard, the `azure-token` function and the Speech SDK. Signup had been blocked since 2026-10-01.
- The practice and progress pages (placeholders), the `/present` picker page, the sentence editor, and the optional `GEMINI_LITE_MODEL`.

Cancelled before being built: sentence practice, the word sheet, shadowing, drills, the progress dashboard, the per-attempt `feedback` action, the discussion chat, and reference audio per sentence.

To bring any of it back: the full plan is in `docs/ARCHITECTURE-v1-full.md` and the matching code is at git tag `full-scope-v1`. The database still has the full plan's tables and columns (§6), so a restore needs no migration.

---

## 13. Open Items to Verify Live

None of these has been verified.
1. A full-length take through the Gemini Files API on the free tier (size, token and time limits).
2. Accuracy of Gemini's timestamps for the ▶ You slice (±0.5 s margin).
3. `speak` on the free tier (quota and model availability).
4. `keywords` for memorization level L3.
5. Coach tips and their anchors on a real take, and the thresholds in `THRESHOLDS` (`src/lib/tips.ts`).
6. Login, and the microphone inside the installed PWA, on the phone.
