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
  - `ai` function: `run_report` (recording through the Gemini Files API) and `keywords`; not deployed yet.
  - The report's AI section: one-time privacy notice, feedback, Corrections cards. ▶ your voice is cut from the take with a byte range and anchored to Azure's words; ▶ American voice is Azure TTS cached in `reference-audio`. Plus the audio switch in Settings and memorization level L3.
  - All of it untested against the live APIs. Waiting on: the Gemini key (deploy `ai`, then a live check of `run_report`, `keywords` and the Files API limits), the Azure key (assessment, American voice), the spike report.
  - Migration `20260927161100_save_attempt` applied via the Supabase MCP.
  - Azure signup, 2026-10-01: Microsoft blocked account creation ("unusual activity") through both GitHub and Gmail. Retry after 24 h, without VPN or iCloud Private Relay, or from another network. If it stays blocked, decide on a plan without Azure (it loses phoneme-level scores).
- [ ] Sprint 2b — Coach tips in the run report · tips draft (44, from the NotebookLM notebook "Storytelling") waiting for approval; working copy in `private/coach-tips/` (gitignored, so it is not in cloud sessions: keep a copy)
- [ ] Sprint 3 — Script Studio + reference audio
- [ ] Sprint 4 — Sentence practice, AI feedback, progress
