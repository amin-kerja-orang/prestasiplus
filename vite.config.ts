import { fileURLToPath, URL } from 'node:url'

import ui from '@nuxt/ui/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

import { iconBundle, uiConfig } from './src/theme/ui.config.ts'

// Static-hosting artifact build (scripts/build-artifact.mjs sets VITE_ARTIFACT=1): relative base,
// few large chunks (publish limit on file count).
const artifact = process.env.VITE_ARTIFACT === '1'

// https://vite.dev/config/
export default defineConfig({
  base: artifact ? './' : '/',
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
  build: artifact
    ? {
        assetsInlineLimit: 32_768,
        chunkSizeWarningLimit: 4000,
        rollupOptions: {
          output: {
            manualChunks(id: string) {
              // The in-process mock (seeds, handlers, datasets) is its own chunk, so the UI chunks
              // (login, shells) load without it and the mock boots in the background.
              if (
                /[\\/]src[\\/]mock[\\/]/.test(id) ||
                /[\\/]src[\\/]modules[\\/][^\\/]+[\\/]mock[\\/]/.test(id)
              )
                return 'mock-data'
              // Shared code the mock also imports is pinned to the app core, otherwise it is
              // pulled into `mock-data` and the entry then has to download the whole mock.
              if (
                /[\\/]src[\\/](api|lib|app)[\\/]/.test(id) ||
                /[\\/]src[\\/]modules[\\/][^\\/]+[\\/](api|lib)[\\/]/.test(id)
              )
                return 'app-core'
              const m = /[\\/]src[\\/]modules[\\/]([^\\/]+)[\\/]/.exec(id)
              if (m) return `mod-${m[1]}`
              if (id.includes('node_modules')) {
                if (/iconify/.test(id)) return 'vendor-icons'
                if (/[\\/](chart\.js|html2canvas)[\\/]/.test(id)) return 'vendor-extra'
                return 'vendor'
              }
              return undefined
            },
          },
        },
      }
    : undefined,
  preview: {
    port: 4173,
    strictPort: true,
  },
})
