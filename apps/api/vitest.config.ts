import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// SWC is needed for `emitDecoratorMetadata` (Nest DI); esbuild does not emit it.
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    environment: 'node',
    globalSetup: ['test/support/global-setup.ts'],
    include: ['test/**/*.spec.ts', 'src/**/*.spec.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Importing app.module validates the env; a closed port keeps tests without a DB honest.
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/none',
    },
    testTimeout: 30_000,
    hookTimeout: 120_000, // first run pulls the Postgres image
  },
})
