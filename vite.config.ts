/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app from /<repo>/; dev runs from the root.
const PAGES_BASE = process.env.BASE_PATH ?? '/lecture-coach/'

const LIGHT_BG = '#f7f6f3'

export default defineConfig(({ command }) => {
  const base = command === 'build' ? PAGES_BASE : '/'

  return {
    base,
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    // React + supabase-js + router form a ~600 kB core chunk; the Speech SDK is split out lazily.
    build: { chunkSizeWarningLimit: 700 },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
        manifest: {
          id: base,
          name: 'מאמן הרצאות · Lecture Coach',
          short_name: 'מאמן הרצאות',
          description: 'אימון הרצאות באנגלית: תסריט, הגייה, חזרות והתקדמות',
          lang: 'he',
          dir: 'rtl',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'any',
          background_color: LIGHT_BG,
          theme_color: LIGHT_BG,
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // PDF.js only runs while importing slide images, which needs the network anyway.
          globIgnores: ['**/pdf-*.js', '**/pdf.worker*'],
          // The Speech SDK chunk is large; it is lazy-loaded but still worth caching.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: {
      // Edge Function modules without Deno APIs (e.g. ai/contract.ts) are tested here too.
      include: ['src/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
      environment: 'node',
    },
  }
})
