import { fileURLToPath, URL } from 'node:url'

import ui from '@nuxt/ui/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

import { iconBundle, uiConfig } from './src/theme/ui.config.ts'

// https://vite.dev/config/
export default defineConfig({
  // `@nuxt/ui/vite` registers `@tailwindcss/vite` itself: do not add it again (V2-T02, check b).
  plugins: [
    vue(),
    ui({
      colorMode: false, // own toggle: src/theme/color-mode.ts (V2-T03)
      theme: { colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral'] },
      ui: uiConfig,
      icon: { clientBundle: iconBundle },
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
