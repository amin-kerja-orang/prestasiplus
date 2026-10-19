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
    include: ['test/**/*.spec.ts', 'src/**/*.spec.ts'],
    env: { NODE_ENV: 'test', LOG_LEVEL: 'silent' },
    testTimeout: 30_000,
  },
})
