import { fileURLToPath, URL } from 'node:url'

import ui from '@nuxt/ui/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

import { uiConfig } from './src/theme/ui.config.ts'

// https://vite.dev/config/
export default defineConfig({
  // `@nuxt/ui/vite` registers `@tailwindcss/vite` itself: do not add it again (V2-T02, check b).
  plugins: [
    vue(),
    ui({
      colorMode: true,
      theme: { colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral'] },
      ui: uiConfig,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
})
