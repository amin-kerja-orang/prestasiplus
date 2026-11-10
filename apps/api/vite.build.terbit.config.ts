import { mergeConfig } from 'vite'

import base from './vite.build.config.ts'

/**
 * Second bundle of the API build: `dist/migrate-terbit.js`, the `migrate:terbit` command (design 10.5). Same plugins as the API (SWC with
 * `decoratorMetadata`, so the Nest providers resolve), but a different entry. It runs AFTER the main build and must not empty `dist`.
 * Run: `node dist/migrate-terbit.js --apply` (see docs/ops/r1-uat-deploy.md).
 */
export default mergeConfig(base, {
  build: {
    ssr: 'src/migration/load/papers/terbit-cli.ts',
    emptyOutDir: false,
    rollupOptions: {
      output: { entryFileNames: 'migrate-terbit.js' },
    },
  },
})
