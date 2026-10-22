import swc from 'unplugin-swc'
import { defineConfig } from 'vite'

/**
 * Production build: one ESM bundle `dist/main.js` (SSR/Node build, no browser code).
 * - `@pp/contract` and `@pp/exam-core` ship TypeScript source (extensionless imports) that Node cannot
 *   run, so they are bundled into the output (`ssr.noExternal`). Every other dependency stays external and is
 *   resolved from node_modules (`npm ci --omit=dev -w @pp/api`).
 * - SWC compiles the TypeScript because Nest DI needs `emitDecoratorMetadata` (esbuild lacks it).
 */
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
  ssr: { noExternal: ['@pp/contract', '@pp/exam-core'] },
  build: {
    ssr: true,
    outDir: 'dist',
    emptyOutDir: true,
    target: 'node22',
    sourcemap: true,
    // No keepNames and no minify: `bcryptCore` (modules/auth/legacy-bcrypt.ts) is stringified into worker
    // threads, so it must stay one self-contained function. test/auth/bundle.spec.ts guards this.
    minify: false,
    // The banner keeps the root ESLint (which does not ignore apps/*/dist) away from the bundle.
    rollupOptions: {
      // AZ-188: the report-only scan CLI is built next to the server (`node dist/scan-stored.cli.js`).
      input: { main: 'src/main.ts', 'scan-stored.cli': 'src/modules/files/scan-stored.cli.ts' },
      output: { format: 'es', entryFileNames: '[name].js', banner: '/* eslint-disable */' },
    },
  },
})
