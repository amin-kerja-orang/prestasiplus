import swc from 'unplugin-swc'
import { defineConfig } from 'vite'

/**
 * Production build: one ESM bundle `dist/main.js` (SSR/Node build, no browser code).
 * - `@pp/contract` ships TypeScript source (extensionless imports) that Node cannot run, so it is
 *   bundled into the output (`ssr.noExternal`). Every other dependency stays external and is
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
  ssr: { noExternal: ['@pp/contract'] },
  build: {
    ssr: 'src/main.ts',
    outDir: 'dist',
    emptyOutDir: true,
    target: 'node22',
    sourcemap: true,
    minify: false,
    // The banner keeps the root ESLint (which does not ignore apps/*/dist) away from the bundle.
    rollupOptions: {
      output: { format: 'es', entryFileNames: 'main.js', banner: '/* eslint-disable */' },
    },
  },
})
