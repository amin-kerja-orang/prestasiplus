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
    // Every DB spec clones a database in the one Testcontainers Postgres; with one worker per CPU
    // (24 here) CREATE DATABASE ... TEMPLATE alone took 22 s and specs timed out at random (BE-03).
    // 4, not 8: the argon2-heavy auth and users specs starve the event loop and Postgres on a shared
    // host and expired interactive transactions at random (BE-05).
    maxWorkers: 4,
    testTimeout: 30_000,
    hookTimeout: 120_000, // first run pulls the Postgres image
  },
})
