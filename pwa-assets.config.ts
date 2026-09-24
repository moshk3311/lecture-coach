// Generates PWA icons from public/logo.svg:
//   npx @vite-pwa/assets-generator@1 --config pwa-assets.config.ts
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

const INK = '#2c43c9'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: INK } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: INK } },
  },
  images: ['public/logo.svg'],
})
