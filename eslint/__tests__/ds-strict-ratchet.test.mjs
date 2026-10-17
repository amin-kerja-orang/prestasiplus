// Ratchet test (V2-T04): config/ds-strict.json may only grow relative to the committed baseline
// (config/ds-strict.baseline.json) and, when available, to the same file on origin/feature/v2-frontend.
// A 'page' entry may not be relaxed to 'ds'; exemptions may only shrink. To raise the floor,
// append the new globs to BOTH files in the same commit.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  globsOf,
  normalizeDsStrict,
  ratchetViolations,
  readDsStrict,
  styleGlobs,
} from '../ds-strict.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const baseline = normalizeDsStrict(
  JSON.parse(readFileSync(`${ROOT}config/ds-strict.baseline.json`, 'utf8')),
)

/** The list as committed on the integration branch, or null when git / the ref is unavailable. */
function integrationBranchList() {
  try {
    const out = execFileSync('git', ['show', 'origin/feature/v2-frontend:config/ds-strict.json'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    })
    return normalizeDsStrict(JSON.parse(out))
  } catch {
    return null
  }
}

describe('config/ds-strict.json ratchet', () => {
  const current = readDsStrict()

  it('keeps every baseline entry at its level or stricter', () => {
    expect(ratchetViolations(current, baseline)).toEqual([])
  })

  it('does not drop or relax entries of origin/feature/v2-frontend (skipped when unavailable)', (ctx) => {
    const remote = integrationBranchList()
    if (!remote) return ctx.skip()
    expect(ratchetViolations(current, remote)).toEqual([])
  })

  it('has no duplicate strict globs', () => {
    const globs = current.strict.map((e) => e.glob)
    expect(new Set(globs).size).toBe(globs.length)
  })

  it('uses only known levels', () => {
    for (const e of current.strict) expect(['page', 'ds']).toContain(e.level)
  })

  it('ratchetViolations flags removal, relaxation and new exemptions', () => {
    const floor = {
      strict: [
        { glob: 'a/**', level: 'page' },
        { glob: 'b/**', level: 'ds' },
      ],
      exempt: ['x'],
    }
    expect(
      ratchetViolations({ strict: [{ glob: 'a/**', level: 'ds' }], exempt: ['x', 'y'] }, floor),
    ).toEqual([
      'strict entry relaxed from page to ds: a/**',
      'strict entry removed: b/**',
      'exemption added: y',
    ])
    // Tightening ds -> page and adding entries is fine.
    expect(
      ratchetViolations(
        {
          strict: [
            { glob: 'a/**', level: 'page' },
            { glob: 'b/**', level: 'page' },
            { glob: 'c/**', level: 'ds' },
          ],
          exempt: [],
        },
        floor,
      ),
    ).toEqual([])
  })

  it('exposes style globs per level', () => {
    expect(
      globsOf(
        [
          { glob: 'a/**', level: 'ds' },
          { glob: 'b/**', level: 'page' },
        ],
        'ds',
      ),
    ).toEqual(['a/**'])
    expect(styleGlobs(['src/ds/**', 'src/a/B.vue'])).toEqual([
      'src/ds/**/*.{css,vue}',
      'src/a/B.vue',
    ])
  })

  it('accepts legacy string entries as page level', () => {
    expect(normalizeDsStrict({ strict: ['src/x/**'], exempt: [] }).strict).toEqual([
      { glob: 'src/x/**', level: 'page' },
    ])
  })
})
