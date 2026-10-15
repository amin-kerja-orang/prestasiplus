// Ratchet test (V2-T04): config/ds-strict.json may only grow relative to the committed baseline
// (config/ds-strict.baseline.json); exemptions may only shrink. To raise the floor, append the new
// globs to BOTH files in the same commit.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { readDsStrict, styleGlobs } from '../ds-strict.mjs'

const baseline = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../config/ds-strict.baseline.json', import.meta.url)),
    'utf8',
  ),
)

describe('config/ds-strict.json ratchet', () => {
  const current = readDsStrict()

  it('keeps every baseline strict glob', () => {
    const missing = baseline.strict.filter((g) => !current.strict.includes(g))
    expect(
      missing,
      `strict globs removed from config/ds-strict.json: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('does not add exemptions beyond the baseline', () => {
    const added = current.exempt.filter((g) => !baseline.exempt.includes(g))
    expect(added, `new exemptions are not allowed: ${added.join(', ')}`).toEqual([])
  })

  it('has no duplicate strict entries', () => {
    expect(new Set(current.strict).size).toBe(current.strict.length)
  })

  it('exposes style globs for Stylelint', () => {
    expect(styleGlobs(['src/ds/**', 'src/a/B.vue'])).toEqual([
      'src/ds/**/*.{css,vue}',
      'src/a/B.vue',
    ])
  })
})
