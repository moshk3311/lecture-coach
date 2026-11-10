# Lecture Coach — Claude Code Instructions

Personal PWA for rehearsing an English lecture (Hebrew-native speaker).
It does two jobs: rehearse in front of the slides, and record a take and get AI feedback.
Spec of what exists: `docs/ARCHITECTURE.md`.

## Frozen until after the lecture
- **No new features.** Only fix what breaks in the owner's real rehearsals.
- The app was cut down on 2026-11-10. The full plan (Azure scoring, sentence practice, progress, chat, per-sentence audio) is archived in `docs/ARCHITECTURE-v1-full.md`; its code is at git tag `full-scope-v1`. Do not bring any of it back unless the owner asks.
- The database still has the full plan's tables and columns (empty). Leave them.

## Working rules
- Before a task: ask clarifying questions if needed, then present a short plan and **wait for approval** before writing code.
- Keep explanations brief. Talk to me in Hebrew; code, comments and commits in English.
- Never put secrets in client code. The Gemini key lives only in Supabase secrets.
- Free tiers only. If a limit or API behavior blocks something, stop and tell me before working around it.
- TypeScript strict. Vitest unit tests for parsers (PPTX) and metrics.
- UI is Hebrew RTL. All English learning content is wrapped in `dir="ltr" lang="en"`.
- Mobile-first: check every changed screen at 390px width and on desktop (`e2e/`: screenshots on a mocked Supabase, no login needed).
- Never block the core flow on an LLM failure: the presenter, the recording and the slide times must work without Gemini.
- All LLM and voice calls go through the provider interfaces in `src/providers/`.
- Commit after each completed task (Conventional Commits).

## Commands
```bash
npm run dev          # local dev
npm run build        # production build
npm run test         # vitest
npm --prefix e2e run screens             # with npm run dev running: every screen at 390px + desktop (setup: e2e/README.md)
npm --prefix e2e run all                 # screens + take, retention, AI report, tips, draft, americanize flows
npx supabase db push                     # apply migrations (the CLI is a dev dependency)
npx supabase functions deploy ai         # deploy the edge function
npx supabase secrets set KEY=value       # set server secrets
```
If the e2e scripts cannot reach `127.0.0.1:5173`, run them with `APP=http://localhost:5173/#`.

## Status
Supabase project: `lecture-coach` (`gzppgmoegcsdtovcdkmy`, eu-central-1). Migrations are applied via the Supabase MCP; local file names match the remote versions. Coach tips (44, approved 2026-10-06) live only in the `coach_tips` table; the working copy is in `private/coach-tips/` (gitignored). e2e uses a made-up catalog.

Built and passing unit tests and e2e:
- Login, lectures list, create/edit/delete.
- Import: PPTX (text, notes → first script) + slide images from a PDF export.
- Lecture page: script per slide, word and speaking-time estimates, "הצע מלל" (`draft_script`), "תקן לאמריקאית" (`americanize`). Both checked live by the owner in October.
- Presenter view: slide, next slide, script, timer with planned windows, inline edit, memorization L0–L4, keyboard/clicker/swipe.
- Take recording (16 kHz WAV, slide timestamps), run report (time per slide vs plan, recording), run history, newest 10 recordings kept.
- AI feedback on a take (`run_report`): delivery feedback, Corrections with ▶ you / ▶ American, coach tips (timing rules + what Gemini hears).

Not yet checked live (do these on the owner's real lecture, fix only what breaks):
- [ ] Login on the phone; a full rehearsal on desktop and on the phone.
- [ ] A full-length take through `run_report` (Gemini Files API limits on the free tier; checked only on 19 s).
- [ ] ▶ you: is the slice from Gemini's approximate times close enough? If not, widen the margin in `src/lib/anchor.ts`.
- [ ] ▶ American (`speak`, free tier only, never enable billing) and L3 keywords (`keywords`). If one does not work on the free tier, remove it rather than work around it.
- [ ] Coach tips and their anchors on a real take.
