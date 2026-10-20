import { fileURLToPath } from 'node:url'

import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from '../../vite.config.ts'

/**
 * The conformance run against the frontend mock (full registry boot, about 1 minute). It lives
 * outside the root `unit` project (`*.conformance.ts` is not a `*.test.ts`), so `npm test` stays
 * fast. Run it with `npm run conformance`.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      alias: {
        '@nuxt/ui/vue-plugin': fileURLToPath(
          new URL('../../src/test-support/nuxt-ui-plugin-stub.ts', import.meta.url),
        ),
      },
    },
    test: {
      environment: 'node',
      env: { VITE_PROTOTYPE_SCOPE: 'off', VITE_DATA_PROFILE: 'full' },
      root: fileURLToPath(new URL('../../', import.meta.url)),
      server: { deps: { inline: [/@nuxt\/ui/] } },
      include: ['packages/contract-tests/mock/*.conformance.ts'],
      testTimeout: 30_000,
      hookTimeout: 180_000,
    },
  }),
)
