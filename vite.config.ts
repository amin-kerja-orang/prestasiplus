import { execFileSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'

import ui from '@nuxt/ui/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

import { iconBundle, uiConfig } from './src/theme/ui.config.ts'

// Static-hosting artifact build (scripts/build-artifact.mjs sets VITE_ARTIFACT=1): relative base,
// few large chunks (publish limit on file count).
const artifact = process.env.VITE_ARTIFACT === '1'

/**
 * Short commit SHA of this build (UAT T0): `git rev-parse --short HEAD`, then `VITE_BUILD_SHA`
 * (Docker builds have no `.git`), then Cloudflare Pages' `CF_PAGES_COMMIT_SHA`, then 'unknown'.
 * A `+dirty` suffix marks a build made with uncommitted changes to tracked files.
 */
function resolveBuildSha(): string {
  const git = (...args: string[]): string =>
    execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  try {
    const sha = git('rev-parse', '--short', 'HEAD')
    if (sha) {
      let dirty = ''
      try {
        dirty = git('status', '--porcelain', '--untracked-files=no') ? '+dirty' : ''
      } catch {
        // status unavailable: report the bare SHA
      }
      return sha + dirty
    }
  } catch {
    // git missing or not a repository: fall back to the env vars
  }
  const fromEnv = (process.env.VITE_BUILD_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? '').trim()
  return fromEnv ? fromEnv.slice(0, 7) : 'unknown'
}

const buildSha = resolveBuildSha()
const buildDate = new Date().toISOString().slice(0, 10)

// https://vite.dev/config/
export default defineConfig({
  // Shown on the demo login screen only (`BuildStamp`); see docs/ops/demo-build-version.md.
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
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
