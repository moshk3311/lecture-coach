# Lecture Coach — Claude Code Instructions

Personal PWA for practicing English lectures (Hebrew-native speaker).
Full spec: `docs/ARCHITECTURE.md`. Read the relevant sections before each sprint/task.

## Working rules
- Work sprint by sprint (ARCHITECTURE §11). Before each sprint or major task: ask clarifying questions if needed, then present a short plan and **wait for approval** before writing code.
- Keep explanations brief. Talk to me in Hebrew; code, comments and commits in English.
- Never put secrets in client code. Azure/Gemini keys live only in Supabase secrets.
- TypeScript strict. Vitest unit tests for parsers (PPTX, Azure result) and metrics.
- UI is Hebrew RTL. All English learning content is wrapped in `dir="ltr" lang="en"`.
- Mobile-first: check every screen at 390px width and on desktop (`e2e/`: screenshots on a mocked Supabase, no login needed).
- Never block the core flow on an LLM failure — Azure scores must always show.
- All speech/LLM calls go through the provider interfaces in `src/providers/`.
- Commit after each completed task (Conventional Commits).
- If a free-tier limit or API behavior differs from the spec, stop and tell me before working around it.
- At the end of each sprint: update the Status section below and give me a short demo checklist.

## Commands
```bash
npm run dev          # local dev
npm run build        # production build
npm run test         # vitest
npm --prefix e2e run screens             # with npm run dev running: every screen at 390px + desktop (setup: e2e/README.md)
npm --prefix e2e run all                 # screens + take recording + recording retention flows
npx supabase db push                     # apply migrations (the CLI is a dev dependency)
npx supabase functions deploy <name>     # deploy an edge function
npx supabase secrets set KEY=value       # set server secrets
```

## Status
- [ ] Sprint 0 — Setup · code, DB, `azure-token`, deploy and auth settings done (login emails via Gmail SMTP); login works on desktop; waiting on the Azure and Gemini secrets and a login check on the phone
  - Supabase project: `lecture-coach` (`gzppgmoegcsdtovcdkmy`, eu-central-1). Migrations applied via the Supabase MCP; local file names match the remote versions.
  - Verified limits and API behavior: ARCHITECTURE Appendix B.
- [ ] Sprint 1 — Lecture import + Presenter view (MVP 1/2) · built: lectures CRUD, PPTX import (tested on 2 real decks), slide images from a PDF export (PDF.js), presenter view; waiting on the owner's demo check (desktop + phone). Slide images come from a PDF export; the VPS converter was dropped (no server)
  - Migration `20260926204005_slide_scripts` applied via the Supabase MCP. Test decks: the owner's Google Drive folder "מקנזי" (PPTX + Google Slides); download into `private/decks/` (gitignored) for the local-only parser test.
- [ ] Sprint 2 — Full-run recording + Run report (MVP 2/2) · built without keys:
  - Take recording (AudioWorklet, 16 kHz WAV) with slide timestamps, `save_attempt`, timing and speech metrics, run report, run history, Azure usage meter.
  - Recording retention: keeps the newest 10 take recordings (owner's choice: 1 GB storage).
  - Assessment of a saved take (Azure continuous mode).
  - `ai` function: `run_report` (recording through the Gemini Files API) and `keywords`; deployed 2026-10-04 with `GEMINI_API_KEY`/`GEMINI_MODEL` set. `run_report` checked live on a 19 s take (feedback and Corrections shown); `keywords` (L3) and the Files API limits on long takes not checked yet.
  - The report's AI section: one-time privacy notice, feedback, Corrections cards. ▶ your voice is cut from the take with a byte range and anchored to Azure's words; ▶ American voice is Gemini TTS (`ai` action `speak`, owner's choice after the Azure block) cached in `reference-audio`. Plus the audio switch in Settings and memorization level L3.
  - Waiting on: the live check of `keywords` and of a full-length take, a live check of `speak` (free tier only, never enable billing), the Azure key (phoneme assessment only), the spike report.
  - Migration `20260927161100_save_attempt` applied via the Supabase MCP.
  - Azure signup, 2026-10-01: Microsoft blocked account creation ("unusual activity") through both GitHub and Gmail. Retry after 24 h, without VPN or iCloud Private Relay, or from another network. If it stays blocked, decide on a plan without Azure (it loses phoneme-level scores).
- [ ] Sprint 2b — Coach tips in the run report · built, deployed `ai` (2026-10-07), not pushed to Pages yet:
  - Owner approved the 44 tips (2026-10-06); imported into `coach_tips` (migration `20261006173811_coach_tips` applied via the Supabase MCP). Content only in the DB; the working copy stays in `private/coach-tips/` (gitignored, so it is not in cloud sessions: keep a copy).
  - Rules (`src/lib/tips.ts`: `detectIssues`, `selectTips`, tested) pick up to 3 tips from timing, Azure speech metrics and history; saved in `attempts.metrics.tips`; shown at the end of the run report with evidence and sources. `run_report` anchors them to a moment and adds up to 2 tips from listening. Without Azure, Gemini reports the speech triggers from listening (ARCHITECTURE §5.8).
  - Not done: calibrating the thresholds on 3+ real takes; checking the tips and anchors live on a real take (needs the Pages build).
  - e2e uses a made-up catalog (`e2e/lib/tips.js`), never the real tips.
- [ ] Sprint 3 — Script Studio + reference audio · started 2026-10-09:
  - Done: `draft_script` (deployed, low thinking since 2026-10-15) and the "✎ הצע מלל" pencil per slide on the lecture page, plus "draft every slide without a script"; e2e `draft.js`. Checked live by the owner (good base to rewrite; ~1 min before low thinking).
  - Done: `americanize` (deployed 2026-10-19) and "תקן לאמריקאית" per slide with a script: word diff (`src/lib/wordDiff.ts`) and Hebrew reasons, accepted or refused; change notes are not stored (segmentation will change). e2e `americanize.js`. Checked live by the owner (good changes, ~40 s on 3.8 Flash); 2026-10-19 moved to `GEMINI_LITE_MODEL` with minimal thinking (falls back to `GEMINI_MODEL` when unset), speed and quality to compare.
  - Next, in order: sentence segmentation editor + time estimates, reference audio per sentence (Gemini TTS: no word highlighting, "slow" by prompt), chat with proposed edits.
  - Open question: importing without two files (PPTX + PDF); options in the conversation of 2026-10-09.
- [ ] Sprint 4 — Sentence practice, AI feedback, progress
