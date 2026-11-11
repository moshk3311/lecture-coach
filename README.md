# Lecture Coach

A personal PWA for preparing an English lecture: rehearse with slides and script side by side,
then record a full take and get AI feedback on delivery and on what sounds off to an American ear.
Hebrew UI, English content.

Spec: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Stack

React + Vite + TypeScript + Tailwind (PWA on GitHub Pages) · Supabase (Postgres, Auth, Storage,
Edge Functions) · Gemini (coaching, American voice).

## Develop

```bash
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npm install
npm run dev                  # http://localhost:5173
npm run test
npm run build
```

The Gemini API key lives only in Supabase function secrets, never in the client.
