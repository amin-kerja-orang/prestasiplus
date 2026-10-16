import { fileURLToPath } from 'node:url'

import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

/** Performance tests (budgets in ms) run in their own project, alone, after every other test. */
const PERF_TESTS = 'src/**/__tests__/**/*.perf.test.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      alias: {
        // Virtual module of the Nuxt UI Vite plugin; not loadable under Vitest (see the stub).
        '@nuxt/ui/vue-plugin': fileURLToPath(
          new URL('./src/test-support/nuxt-ui-plugin-stub.ts', import.meta.url),
        ),
      },
    },
    test: {
      // Node by default (mock handlers, datasets, libs); component tests opt in
      // to jsdom with a `// @vitest-environment jsdom` docblock (ADR-0011).
      environment: 'node',
      root: fileURLToPath(new URL('./', import.meta.url)),
      // Nuxt UI components import virtual modules (`#build/*`, `#imports`) that only the Vite
      // plugin resolves; inline the package so Vitest runs it through that pipeline (V2-T05).
      server: { deps: { inline: [/@nuxt\/ui/] } },
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,vue}'],
        reporter: ['text', 'html'],
        reportsDirectory: 'coverage',
      },
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            // Script libraries (e.g. the E2E trace parser) keep their tests as .mjs next to them.
            include: [
              'src/**/__tests__/**/*.test.ts',
              'scripts/**/__tests__/**/*.test.mjs',
              'eslint/**/__tests__/**/*.test.mjs',
            ],
            exclude: [...configDefaults.exclude, 'e2e/**', PERF_TESTS],
            // Tests that boot the real registry compile the 466k-question dataset (~2 s per boot,
            // more under load); give them room so load never turns into a timeout failure.
            testTimeout: 30_000,
            hookTimeout: 60_000,
            sequence: { groupOrder: 0 },
          },
        },
        {
          // Timing budgets are only meaningful without other test workers competing for the CPU:
          // this group starts after the unit group has finished, and runs its files one at a time.
          extends: true,
          test: {
            name: 'perf',
            include: [PERF_TESTS],
            exclude: [...configDefaults.exclude, 'e2e/**'],
            fileParallelism: false,
            // Paired measurements re-run under load (up to 3 pairs); allow for it.
            testTimeout: 120_000,
            sequence: { groupOrder: 1 },
          },
        },
      ],
    },
  }),
)
