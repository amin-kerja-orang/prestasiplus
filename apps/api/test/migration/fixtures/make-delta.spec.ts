import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'

const SCRIPT = fileURLToPath(new URL('../../../scripts/rehearsal/mig07-make-delta.mjs', import.meta.url))
const TINY_DIR = fileURLToPath(new URL('./tiny/', import.meta.url))
const INSIDE_REPO = fileURLToPath(new URL('../../../.migration-out/mig07-delta-must-not-exist', import.meta.url))

const tmp = mkdtempSync(join(tmpdir(), 'pp-mig07-delta-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

const run = (src: string, dst: string) => spawnSync(process.execPath, [SCRIPT, src, dst], { encoding: 'utf8' })

describe('mig07-make-delta.mjs', () => {
  it('writes a fresh SHA256SUMS (sha256sum format, sorted, every file but itself), mode 0700 dir and 0600 files', () => {
    const dst = join(tmp, 'ok')
    const r = run(TINY_DIR, dst)
    expect(r.status, r.stderr).toBe(0)
    const names = readdirSync(dst)
    expect(names).toContain('SHA256SUMS')
    expect(names).toContain('manifest.json')
    expect(names).not.toContain('anomalies.json') // the source's one would be stale
    const lines = readFileSync(join(dst, 'SHA256SUMS'), 'utf8').split('\n')
    expect(lines.pop()).toBe('') // ends with a newline
    const listed = lines.map((l) => {
      const m = /^([0-9a-f]{64})  (\S.*)$/.exec(l)
      expect(m, l).not.toBeNull()
      return [(m as RegExpExecArray)[1], (m as RegExpExecArray)[2]] as [string, string]
    })
    const sorted = names.filter((n) => n !== 'SHA256SUMS').sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    expect(listed.map(([, n]) => n)).toEqual(sorted)
    for (const [hash, name] of listed) expect(hash === createHash('sha256').update(readFileSync(join(dst, name))).digest('hex'), name).toBe(true)
    // Not the source's checksum file (the delta changes data, so the hashes of the changed tables differ).
    expect(readFileSync(join(dst, 'SHA256SUMS'), 'utf8')).not.toBe(readFileSync(join(TINY_DIR, 'SHA256SUMS'), 'utf8'))
    if (process.platform !== 'win32') {
      expect(statSync(dst).mode & 0o777).toBe(0o700)
      for (const n of names) expect(statSync(join(dst, n)).mode & 0o777, n).toBe(0o600)
    }
  })

  it('refuses an output directory inside the repository (exit 2, nothing written)', () => {
    const r = run(TINY_DIR, INSIDE_REPO)
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/inside the repository/)
    expect(existsSync(INSIDE_REPO)).toBe(false)
  })

  it('refuses a non-empty output directory and a source that is not synthetic', () => {
    const full = join(tmp, 'full')
    expect(run(TINY_DIR, full).status).toBe(0)
    const again = run(TINY_DIR, full)
    expect(again.status).toBe(2)
    expect(again.stderr).toMatch(/not empty/)

    const real = join(tmp, 'not-synthetic')
    expect(run(TINY_DIR, real).status).toBe(0)
    const manifest = JSON.parse(readFileSync(join(real, 'manifest.json'), 'utf8')) as Record<string, unknown>
    manifest.synthetic = false
    writeFileSync(join(real, 'manifest.json'), JSON.stringify(manifest))
    const r = run(real, join(tmp, 'from-not-synthetic'))
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/synthetic/)
  })
})
