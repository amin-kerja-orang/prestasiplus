// T2 (docs/design/v2-admin-page-templates.md section 4): ratchet of the strict Portal Pentadbiran lint.
// Fails when a baseline count would be exceeded, a file outside the baseline has any violation, an
// `enforce` file has any violation, or an `enforce` glob of the committed floor
// (config/ds-strict.baseline.json `enforce`) is removed.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { readAdminStrict } from '../admin-strict.mjs'
import { matcher } from '../lib/glob.mjs'
import { newViolations, readBaseline, runAdminLint } from '../../scripts/lint-admin.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

describe('T2 admin lint ratchet', () => {
  const cfg = readAdminStrict()

  it('has no new violation beyond the baseline (enforce files: none at all)', async () => {
    const result = await runAdminLint()
    const bad = newViolations(result, readBaseline(), cfg)
    expect(bad.map((b) => `${b.file} ${b.rule}: ${b.count} > ${b.allowed}`)).toEqual([])
  }, 300_000)

  it('keeps every enforce glob of the committed floor', () => {
    const floor = JSON.parse(readFileSync(`${ROOT}config/ds-strict.baseline.json`, 'utf8'))
    const missing = (floor.enforce ?? [])
      .map((e) => (typeof e === 'string' ? e : e.glob))
      .filter((g) => !cfg.enforce.some((e) => e.glob === g))
    expect(missing).toEqual([])
  })

  it('lists no enforced file in the baseline', () => {
    const enforced = matcher(cfg.enforce.map((e) => e.glob))
    expect(Object.keys(readBaseline()).filter(enforced)).toEqual([])
  })

  it('newViolations applies the rules', () => {
    const result = { byFile: { 'a/A.vue': { r: 3 }, 'b/B.vue': { r: 1 }, 'c/C.vue': { r: 2 } } }
    const baseline = { 'a/A.vue': { r: 3 }, 'b/B.vue': { r: 0 } }
    const out = newViolations(result, baseline, { enforce: [{ glob: 'a/**' }] })
    expect(out.map((o) => o.file)).toEqual(['a/A.vue', 'b/B.vue', 'c/C.vue'])
    expect(newViolations({ byFile: { 'a/A.vue': { r: 3 } } }, baseline, { enforce: [] })).toEqual([])
  })
})
