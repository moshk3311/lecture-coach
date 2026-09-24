# Lecture Coach

A personal PWA for practicing English lectures: co-write the script, hear American reference audio,
record yourself, get word- and phoneme-level pronunciation feedback, and rehearse with slides and
script side by side. Hebrew UI, English content.

Spec: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Stack

React + Vite + TypeScript + Tailwind (PWA on GitHub Pages) · Supabase (Postgres, Auth, Storage,
Edge Functions) · Azure Speech (pronunciation assessment, TTS) · Gemini (coaching).

## Develop

```bash
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npm install
npm run dev                  # http://localhost:5173
npm run test
npm run build
```

API keys for Azure and Gemini live only in Supabase function secrets, never in the client.
