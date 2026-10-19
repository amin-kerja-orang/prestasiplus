import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'
import { describe, expect, it } from 'vitest'

/**
 * `bcryptCore` is stringified into worker threads, so it must survive the production build as a
 * self-contained function. This builds the bundle into a temp folder, cuts the function out of
 * it, runs it alone in plain Node and checks a hash produced by PHP password_hash.
 */
describe('production bundle keeps bcryptCore self-contained', () => {
  it('computes a known $2y$ hash when cut out of the built bundle', async () => {
    const root = fileURLToPath(new URL('../..', import.meta.url))
    const out = mkdtempSync(join(tmpdir(), 'pp-bundle-'))
    try {
      await build({
        root,
        configFile: join(root, 'vite.build.config.ts'),
        logLevel: 'silent',
        build: { outDir: out, emptyOutDir: true, sourcemap: false },
      })
      const bundle = readFileSync(join(out, 'main.js'), 'utf8')
      const start = bundle.indexOf('function bcryptCore')
      expect(start).toBeGreaterThan(-1)
      const end = bundle.indexOf('\n}\n', start) + 3
      const script = join(out, 'core.cjs')
      writeFileSync(
        script,
        `const core = ${bundle.slice(start, end)};\nprocess.stdout.write(core('Rahsia-Ujian-1', 's5hiTkaNRWLesw5wNVwQ4.', 5, '2y'))`,
      )
      const hash = execFileSync(process.execPath, [script], { encoding: 'utf8' })
      expect(hash).toBe('$2y$05$s5hiTkaNRWLesw5wNVwQ4.zACielzo6GZcTGWIDTWRfsOOFije9TC')
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  }, 120_000)
})
