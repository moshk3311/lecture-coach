# e2e: screenshot and flow checks

Runs the real app in Chromium against an **in-memory Supabase** (`lib/mock.js`): no login, no network, nothing touches the real project. A **fake microphone** (`lib/fakeMic.js`) feeds a tone loop, so takes can be recorded. Use it to check every screen at 390 px and on desktop (CLAUDE.md working rules) and to replay flows after a change.

## Setup (once)

```bash
cd e2e
npm install
npx playwright install chromium   # skip in cloud sessions: Chromium is preinstalled there
```

The mock builds the session key from the project ref in `lib/mock.js`; it must match `VITE_SUPABASE_URL` in `.env.local`.

## Run

Start the app first (`npm run dev` in the repo root, port 5173), then from `e2e/`:

| Command | What it checks |
|---------|----------------|
| `npm run screens` | Every screen on a phone (390 px) and a desktop, the presenter also in phone landscape. Fails on sideways scroll, page errors or unmocked requests. |
| `npm run take` | Records a take from the presenter with the fake mic → saved attempt, WAV upload, slide timestamps, report, assessment without Azure keys, history, usage meter. |
| `npm run retention` | Keeps the newest 10 recordings, drops those of deleted lectures, cleans up after a discarded failed save. |
| `npm run import -- <deck.pptx> [deck.pdf]` | Imports a real deck (test decks: `private/decks/`, git ignores it) → slides, script, slide images, lecture page and presenter. |
| `npm run ai` | The run report's AI section on the mocked `ai` function: the one-time privacy notice, a report with Corrections, ▶ You cut from the recording with a byte range, the American voice without Azure keys, a failed request and its retry, and the audio switch in Settings. |
| `npm run all` | `screens`, `take`, `retention` and `ai`. |

Screenshots go to `e2e/out/` (git ignores it). Each script prints `ok`/`FAIL` lines and exits with 1 on a failure. `APP=<url>` points the scripts at another server (default `http://127.0.0.1:5173/#`).

## Extending

- New screen: add a row to the `screens` list in `screens.js` (route + a text that shows the page is ready).
- New table, RPC or bucket call: answer it in `lib/mock.js`. An unmocked request fails the run and is listed.
- Seed data: `lib/seeds.js` (a 3-slide lecture, saved takes, an assessed take); Gemini's mocked answers: `lib/ai.js`.
- Port 5173 taken by another app: start the dev server with `PORT=<port> npm run dev` and run the scripts with `APP=http://localhost:<port>/#`.
